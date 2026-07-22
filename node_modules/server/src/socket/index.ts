import { Server, Socket } from 'socket.io';
import { roomsStorage } from '../storage';
import { Player, Room, ChatMessage, Round } from 'shared';
import { createDeck, shuffle, dealCards, evaluateHand, compareHands, handTypeToString } from '../game/engine';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getNextPlayer(room: Room, currentId: string): string | null {
  const currentIndex = room.playerOrder.indexOf(currentId);
  for (let i = 1; i <= room.playerOrder.length; i++) {
    const nextIndex = (currentIndex + i) % room.playerOrder.length;
    const pid = room.playerOrder[nextIndex];
    if (room.players[pid].state === 'PLAYING') {
      return pid;
    }
  }
  return null;
}

function getPreviousPlayer(room: Room, currentId: string): string | null {
  const currentIndex = room.playerOrder.indexOf(currentId);
  for (let i = 1; i < room.playerOrder.length; i++) {
    let prevIndex = currentIndex - i;
    if (prevIndex < 0) prevIndex += room.playerOrder.length;
    const pid = room.playerOrder[prevIndex];
    if (room.players[pid].state === 'PLAYING') {
      return pid;
    }
  }
  return null;
}

function calculateSettlements(room: Room) {
  const players = Object.values(room.players) as Player[];
  const nets = players.map(p => ({ id: p.id, net: p.wallet - p.invested }));
  const debtors = nets.filter(n => n.net < 0).sort((a, b) => a.net - b.net);
  const creditors = nets.filter(n => n.net > 0).sort((a, b) => b.net - a.net);
  const settlements = [];
  
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = Math.min(-d.net, c.net);
    if (amount > 0) {
      settlements.push({ fromId: d.id, toId: c.id, amount });
    }
    d.net += amount;
    c.net -= amount;
    if (d.net === 0) i++;
    if (c.net === 0) j++;
  }
  return settlements;
}

async function markRoomInactive(io: Server, roomId: string, reason: string) {
  const room = await roomsStorage.get(roomId);
  if (room && room.status === 'ACTIVE') {
    room.status = 'ENDED';
    await roomsStorage.set(roomId, room);
    io.to(roomId).emit('room_timeout', reason);
    io.in(roomId).socketsLeave(roomId);
  }
}

export function registerSocketHandlers(io: Server) {
  // Global inactivity and turn checker
  setInterval(async () => {
    const rooms = await roomsStorage.getAll();
    for (const room of rooms) {
      if (room.status === 'ACTIVE') {
        const timeSinceLastActivity = Date.now() - room.lastActivityTime;
        if (timeSinceLastActivity > INACTIVITY_TIMEOUT_MS) {
          await markRoomInactive(io, room.id, 'Room became inactive due to 5 minutes of no activity.');
          continue;
        }

        // Turn Timer Auto-play
        if (room.activeRound && room.activeRound.state === 'IN_PROGRESS' && room.activeRound.turnExpiry && Date.now() > room.activeRound.turnExpiry) {
          
          // Handle Side Show Timeout Edge Case
          if (room.activeRound.pendingSideShow) {
            // Target player timed out, auto-decline and pass turn back
            const reqId = room.activeRound.pendingSideShow.requesterId;
            const reqPlayer = room.players[reqId];
            if (reqPlayer) {
              const refund = room.activeRound.minimumBet * 4;
              reqPlayer.wallet += refund;
              reqPlayer.betAmount -= refund;
              room.activeRound.pot -= refund;
            }
            room.activeRound.currentTurnId = getNextPlayer(room, reqId);
            room.activeRound.turnExpiry = Date.now() + 60000;
            room.activeRound.pendingSideShow = undefined;
            
            room.lastActivityTime = Date.now();
            await roomsStorage.set(room.id, room);
            broadcastRoomUpdate(io, room.id, room);
            continue;
          }

          const pid = room.activeRound.currentTurnId;
          if (pid && room.players[pid]) {
            const player = room.players[pid];
            player.missedTurns += 1;
            
            if (player.missedTurns >= 3) {
              // Fold them
              player.state = 'PACKED';
              
              // Check if game ends
              const playingPlayers = Object.values(room.players).filter(p => p.state === 'PLAYING');
              if (playingPlayers.length === 1) {
                room.activeRound.state = 'COMPLETED';
                room.activeRound.winnerIds = [playingPlayers[0].id];
                room.activeRound.winReason = 'All other players packed';
                playingPlayers[0].wallet += room.activeRound.pot;
              } else {
                room.activeRound.currentTurnId = getNextPlayer(room, pid);
                room.activeRound.turnExpiry = Date.now() + 60000;
              }
            } else {
              // Auto-bet
              const amount = player.seen ? room.activeRound.minimumBet * 2 : room.activeRound.minimumBet;
              if (player.wallet >= amount) {
                player.wallet -= amount;
                player.betAmount += amount;
                room.activeRound.pot += amount;
              } else {
                player.state = 'PACKED'; // Not enough money, auto fold
              }
              
              const playingPlayers = Object.values(room.players).filter(p => p.state === 'PLAYING');
              if (playingPlayers.length === 1) {
                room.activeRound.state = 'COMPLETED';
                room.activeRound.winnerIds = [playingPlayers[0].id];
                room.activeRound.winReason = 'All other players packed';
                playingPlayers[0].wallet += room.activeRound.pot;
              } else {
                room.activeRound.currentTurnId = getNextPlayer(room, pid);
                room.activeRound.turnExpiry = Date.now() + 60000;
              }
            }
            
            room.lastActivityTime = Date.now();
            if (room.activeRound?.state === 'COMPLETED') {
              room.settlements = calculateSettlements(room);
              if (!room.history) room.history = [];
              if (!room.history.some(h => h.roundNumber === room.roundNumber)) {
                room.history.push({
                  roundNumber: room.roundNumber,
                  winnerIds: room.activeRound.winnerIds || [],
                  winReason: room.activeRound.winReason || '',
                  pot: room.activeRound.pot
                });
              }
            }
            await roomsStorage.set(room.id, room);
            broadcastRoomUpdate(io, room.id, room);
          }
        }
      }
    }
  }, 2000); // Check every 2s

  io.on('connection', (socket: Socket) => {
    
    socket.on('create_room', async ({ playerName, avatar, playerId }) => {
      const rooms = await roomsStorage.getAll();
      const activeRoom = rooms.find(r => r.status === 'ACTIVE');
      
      if (activeRoom) {
        socket.emit('error', 'An active room already exists.');
        return;
      }

      const roomId = generateRoomId();
      let id = playerId || Math.random().toString(36).substring(2, 9);
      const clientIp = (socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '').toString();
      
      const newRoom: Room = {
        id: roomId,
        hostId: id,
        config: {
          buyIn: 1000,
          rebuyAmount: 1000,
          maxRebuys: 3,
          autoApprove: true,
          startingBlind: 5
        },
        players: {},
        playerOrder: [],
        dealerId: id,
        locked: false,
        paused: false,
        pendingRebuys: [],
        roundNumber: 0,
        status: 'ACTIVE',
        lastActivityTime: Date.now()
      };

      const newPlayer: Player = {
        id,
        name: playerName,
        avatar,
        socketId: socket.id,
        ip: clientIp,
        connected: true,
        wallet: newRoom.config.buyIn,
        invested: newRoom.config.buyIn,
        won: 0,
        rebuys: 0,
        cards: [],
        state: 'WAITING',
        seen: false,
        betAmount: 0,
        missedTurns: 0
      };

      newRoom.players[id] = newPlayer;
      newRoom.playerOrder.push(id);
      
      await roomsStorage.set(roomId, newRoom);
      
      socket.join(roomId);
      socket.emit('player_id_assigned', { playerId: id, roomId });
      broadcastRoomUpdate(io, roomId, newRoom);
    });

    socket.on('join_room', async ({ playerName, avatar, playerId }) => {
      // Find the single active room
      const rooms = await roomsStorage.getAll();
      const room = rooms.find(r => r.status === 'ACTIVE');
      
      if (!room) {
        socket.emit('error', 'No active room found. Please create one.');
        return;
      }

      let id = playerId || Math.random().toString(36).substring(2, 9);
      const clientIp = (socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '').toString();
      
      // Check if we can reconnect to a disconnected session with the same name AND same IP
      const disconnectedPlayer = Object.values(room.players).find(p => p.name.toLowerCase() === playerName.toLowerCase() && !p.connected && p.ip === clientIp);
      
      if (disconnectedPlayer) {
        id = disconnectedPlayer.id; // Take over the disconnected player's session
      } else {
        // Name uniqueness check
        const isNameTaken = Object.values(room.players).some(p => p.name.toLowerCase() === playerName.toLowerCase() && p.id !== id);
        if (isNameTaken) {
          socket.emit('error', 'Name is already taken in this room.');
          return;
        }
      }

      if (room.locked && !room.players[id]) {
        socket.emit('error', 'Room is locked');
        return;
      }

      socket.join(room.id);
      
      const newPlayer: Player = room.players[id] || {
        id,
        name: playerName,
        avatar,
        socketId: socket.id,
        ip: clientIp,
        connected: true,
        wallet: room.config.buyIn,
        invested: room.config.buyIn,
        won: 0,
        rebuys: 0,
        cards: [],
        state: 'WAITING',
        seen: false,
        betAmount: 0,
        missedTurns: 0
      };
      
      newPlayer.socketId = socket.id;
      newPlayer.connected = true;
      room.players[id] = newPlayer;

      if (!room.playerOrder.includes(id) && newPlayer.state !== 'OUT') {
        room.playerOrder.push(id);
      }
      
      room.lastActivityTime = Date.now();
      await roomsStorage.set(room.id, room);
      
      socket.emit('player_id_assigned', { playerId: id, roomId: room.id });
      broadcastRoomUpdate(io, room.id, room);
    });

    socket.on('player_action', async ({ roomId, type, amount, targetId }) => {
      const room = await roomsStorage.get(roomId);
      if (!room || room.status !== 'ACTIVE') return;
      
      const p = Object.values(room.players).find(p => p.socketId === socket.id);
      if (!p) return;
      
      room.lastActivityTime = Date.now();

      if (type === 'START_GAME') {
        if (room.hostId !== p.id || Object.keys(room.players).length < 2) return;
        
        room.roundNumber = (room.roundNumber || 0) + 1;
        
        let deck = shuffle(createDeck());
        let playingIds = room.playerOrder.filter(pid => room.players[pid].connected && room.players[pid].wallet >= room.config.startingBlind);
        
        if (playingIds.length < 2) return; // Need at least 2 players with money

        // Reset players
        for (const pid of playingIds) {
          room.players[pid].state = 'PLAYING';
          room.players[pid].seen = false;
          room.players[pid].betAmount = room.config.startingBlind;
          room.players[pid].wallet -= room.config.startingBlind; // Collect boot
          room.players[pid].missedTurns = 0;
        }

        // Deal cards
        const hands = dealCards(deck, playingIds.length);
        playingIds.forEach((pid, i) => {
          room.players[pid].cards = hands[i];
        });

        const nextDealerIndex = room.dealerId ? (room.playerOrder.indexOf(room.dealerId) + 1) % room.playerOrder.length : 0;
        room.dealerId = room.playerOrder[nextDealerIndex];
        
        const firstTurnId = getNextPlayer(room, room.dealerId) || playingIds[0];

        room.activeRound = {
          id: Math.random().toString(36).substring(2, 9),
          state: 'IN_PROGRESS',
          pot: room.config.startingBlind * playingIds.length,
          currentTurnId: firstTurnId,
          turnExpiry: Date.now() + 60000,
          minimumBet: room.config.startingBlind,
          winnerIds: [],
          deck: deck,
          actionLog: ['Game Started']
        };
      } 
      else if (room.activeRound && room.activeRound.state === 'IN_PROGRESS') {
        const round = room.activeRound;
        
        if (type === 'SEE_CARDS') {
           p.seen = true;
           io.to(socket.id).emit('private_state', p.cards);
        }
        else {
          // It must be their turn for these actions
          if (round.currentTurnId !== p.id) return;
          
          p.missedTurns = 0; // Reset strikes

          if (type === 'PACK') {
            p.state = 'PACKED';
          } 
          else if (type === 'BLIND' || type === 'CHAAL') {
            if (type === 'BLIND' && p.seen) return; // Cannot play blind if seen
            if (type === 'CHAAL' && !p.seen) return; // Cannot play chaal if blind

            if (p.wallet >= amount) {
               p.wallet -= amount;
               p.betAmount += amount;
               round.pot += amount;
               if (!p.seen) {
                 round.minimumBet = amount;
               } else {
                 round.minimumBet = amount / 2;
               }
            } else {
               p.state = 'PACKED';
            }
          }
          else if (type === 'SIDE_SHOW') {
            const prev = getPreviousPlayer(room, p.id);
            if (prev) {
              const prevPlayer = room.players[prev];
              if (!p.seen || !prevPlayer.seen) {
                return; // Both players must be seen for a side show
              }
              // Chaal amount is minimumBet * 2. Side Show costs 2x Chaal amount.
              const sideShowAmount = round.minimumBet * 4;
              if (p.wallet >= sideShowAmount) {
                p.wallet -= sideShowAmount;
                p.betAmount += sideShowAmount;
                round.pot += sideShowAmount;
                
                round.pendingSideShow = { requesterId: p.id, targetId: prev };
                round.currentTurnId = prev; // Target must respond
                round.turnExpiry = Date.now() + 60000;
              } else {
                p.state = 'PACKED';
              }
            }
          }
          else if (type === 'ACCEPT_SIDE_SHOW') {
            if (round.pendingSideShow && round.pendingSideShow.targetId === p.id) {
              round.resolvingSideShow = round.pendingSideShow;
              round.pendingSideShow = undefined;
              
              // We pause for a moment
              round.currentTurnId = null; 
              await roomsStorage.set(roomId, room);
              broadcastRoomUpdate(io, roomId, room);
              
              // Broadcast both players cards privately to each other
              const reqPlayer = room.players[round.resolvingSideShow.requesterId];
              const tgtPlayer = room.players[round.resolvingSideShow.targetId];
              
              if (reqPlayer.socketId) io.to(reqPlayer.socketId).emit('private_state', tgtPlayer.cards);
              if (tgtPlayer.socketId) io.to(tgtPlayer.socketId).emit('private_state', reqPlayer.cards);

              setTimeout(async () => {
                const refreshedRoom = await roomsStorage.get(roomId);
                if (!refreshedRoom || !refreshedRoom.activeRound) return;
                const r = refreshedRoom.activeRound;
                const resolving = r.resolvingSideShow;
                if (!resolving) return;
                
                const req = refreshedRoom.players[resolving.requesterId];
                const tgt = refreshedRoom.players[resolving.targetId];
                
                const cmp = compareHands(req.cards, tgt.cards);
                if (cmp > 0) {
                  tgt.state = 'PACKED';
                } else {
                  req.state = 'PACKED'; // If tie, requester loses
                }
                
                // Turn goes back to requester (if they survived) or next person
                r.currentTurnId = getNextPlayer(refreshedRoom, req.id);
                r.turnExpiry = Date.now() + 60000;
                r.resolvingSideShow = undefined;
                
                await roomsStorage.set(roomId, refreshedRoom);
                broadcastRoomUpdate(io, roomId, refreshedRoom);
                
                // Resend proper private states
                if (req.socketId) io.to(req.socketId).emit('private_state', req.cards);
                if (tgt.socketId) io.to(tgt.socketId).emit('private_state', tgt.cards);
              }, 4000);
              return; // We return early because of setTimeout
            }
          }
          else if (type === 'DECLINE_SIDE_SHOW') {
            if (round.pendingSideShow && round.pendingSideShow.targetId === p.id) {
              const reqId = round.pendingSideShow.requesterId;
              const reqPlayer = room.players[reqId];
              if (reqPlayer) {
                const refund = round.minimumBet * 4;
                reqPlayer.wallet += refund;
                reqPlayer.betAmount -= refund;
                round.pot -= refund;
              }
              round.currentTurnId = getNextPlayer(room, reqId);
              round.turnExpiry = Date.now() + 60000;
              round.pendingSideShow = undefined;
            }
          }
          else if (type === 'SHOW') {
             const playingPlayers = Object.values(room.players).filter(pl => pl.state === 'PLAYING');
             if (p.wallet >= amount && playingPlayers.length === 2) {
                p.wallet -= amount;
                p.betAmount += amount;
                round.pot += amount;
                
                const cmp = compareHands(playingPlayers[0].cards, playingPlayers[1].cards);
                const winner = cmp > 0 ? playingPlayers[0] : playingPlayers[1];
                const loser = cmp > 0 ? playingPlayers[1] : playingPlayers[0];
                
                round.state = 'COMPLETED';
                round.winnerIds = [winner.id];
                const winEval = evaluateHand(winner.cards);
                round.winReason = handTypeToString(winEval.type);
                winner.wallet += round.pot;
             } else {
                return; // Invalid SHOW action
             }
          }

          // Normal turn cycling if not resolving side show or completed
          if (round.state !== 'COMPLETED' && !round.resolvingSideShow && type !== 'SIDE_SHOW') {
            const playingPlayers = Object.values(room.players).filter(pl => pl.state === 'PLAYING');
            if (playingPlayers.length === 1) {
              // Last man standing
              round.state = 'COMPLETED';
              round.winnerIds = [playingPlayers[0].id];
              round.winReason = 'All other players packed';
              playingPlayers[0].wallet += round.pot;
            } else if (type !== 'ACCEPT_SIDE_SHOW') {
              round.currentTurnId = getNextPlayer(room, p.id);
              round.turnExpiry = Date.now() + 60000;
            }
          }
        }
      }
      
      if (room.activeRound?.state === 'COMPLETED') {
        room.settlements = calculateSettlements(room);
        if (!room.history) room.history = [];
        if (!room.history.some(h => h.roundNumber === room.roundNumber)) {
          room.history.push({
            roundNumber: room.roundNumber,
            winnerIds: room.activeRound.winnerIds || [],
            winReason: room.activeRound.winReason || '',
            pot: room.activeRound.pot
          });
        }
      }
      
      await roomsStorage.set(roomId, room);
      broadcastRoomUpdate(io, roomId, room);
    });

    socket.on('chat_message', async ({ roomId, senderId, senderName, text }) => {
      const room = await roomsStorage.get(roomId);
      if (!room) return;
      
      const message: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        senderId,
        senderName,
        text,
        timestamp: Date.now()
      };
      
      io.to(roomId).emit('chat_message', message);
    });

    socket.on('action_kick_player', async ({ roomId, targetId, requesterId }) => {
      const room = await roomsStorage.get(roomId);
      if (!room || room.hostId !== requesterId) return;
      
      const target = room.players[targetId];
      if (target) {
        target.state = 'OUT';
        target.connected = false;
        
        if (target.socketId) {
          const targetSocket = io.sockets.sockets.get(target.socketId);
          if (targetSocket) {
            targetSocket.emit('error', 'You have been kicked by the host.');
            targetSocket.disconnect(true);
          }
        }
        
        if (room.activeRound && room.activeRound.currentTurnId === targetId) {
          room.activeRound.currentTurnId = getNextPlayer(room, targetId);
          room.activeRound.turnExpiry = Date.now() + 60000;
        }
        
        await roomsStorage.set(roomId, room);
        broadcastRoomUpdate(io, roomId, room);
      }
    });

    socket.on('action_transfer_host', async ({ roomId, targetId, requesterId }) => {
      const room = await roomsStorage.get(roomId);
      if (!room || room.status !== 'ACTIVE') return;
      
      if (room.players[targetId]) {
        room.hostId = targetId;
        await roomsStorage.set(roomId, room);
        broadcastRoomUpdate(io, roomId, room);
      }
    });

    socket.on('request_rebuy', async ({ roomId, amount }) => {
      const room = await roomsStorage.get(roomId);
      if (!room || room.status !== 'ACTIVE') return;

      const p = Object.values(room.players).find(pl => pl.socketId === socket.id);
      if (!p) return;

      if (typeof amount !== 'number' || amount <= 0 || isNaN(amount)) {
        socket.emit('error', 'Invalid fund amount. Must be a positive number.');
        return;
      }

      const isHost = room.hostId === p.id;
      const willAutoApprove = isHost || (p.invested + amount <= 3000);

      if (willAutoApprove) {
        p.wallet += amount;
        p.invested += amount;
        p.rebuys += 1;
        
        // Add activity message
        const systemMessage = {
          id: Math.random().toString(36).substring(2, 9),
          senderId: 'SYSTEM',
          senderName: 'Dealer',
          text: `${p.name} added ₹${amount} directly to their wallet.`,
          timestamp: Date.now()
        };
        io.to(roomId).emit('chat_message', systemMessage);
      } else {
        if (!room.pendingRebuys) room.pendingRebuys = [];
        // Replace existing request from this player if there is one
        room.pendingRebuys = room.pendingRebuys.filter(r => r.playerId !== p.id);
        room.pendingRebuys.push({
          playerId: p.id,
          playerName: p.name,
          amount: amount
        });
      }

      await roomsStorage.set(roomId, room);
      broadcastRoomUpdate(io, roomId, room);
    });

    socket.on('approve_rebuy', async ({ roomId, targetId, requesterId }) => {
      const room = await roomsStorage.get(roomId);
      if (!room || room.status !== 'ACTIVE') return;
      if (room.hostId !== requesterId) return;

      if (!room.pendingRebuys) room.pendingRebuys = [];
      const requestIndex = room.pendingRebuys.findIndex(r => r.playerId === targetId);
      if (requestIndex === -1) return;

      const request = room.pendingRebuys[requestIndex];
      const targetPlayer = room.players[targetId];
      if (targetPlayer) {
        targetPlayer.wallet += request.amount;
        targetPlayer.invested += request.amount;
        targetPlayer.rebuys += 1;

        const systemMessage = {
          id: Math.random().toString(36).substring(2, 9),
          senderId: 'SYSTEM',
          senderName: 'Dealer',
          text: `Host approved ₹${request.amount} add funds for ${targetPlayer.name}.`,
          timestamp: Date.now()
        };
        io.to(roomId).emit('chat_message', systemMessage);
      }

      room.pendingRebuys.splice(requestIndex, 1);
      await roomsStorage.set(roomId, room);
      broadcastRoomUpdate(io, roomId, room);
    });

    socket.on('decline_rebuy', async ({ roomId, targetId, requesterId }) => {
      const room = await roomsStorage.get(roomId);
      if (!room || room.status !== 'ACTIVE') return;
      if (room.hostId !== requesterId) return;

      if (!room.pendingRebuys) room.pendingRebuys = [];
      room.pendingRebuys = room.pendingRebuys.filter(r => r.playerId !== targetId);

      await roomsStorage.set(roomId, room);
      broadcastRoomUpdate(io, roomId, room);
    });

    socket.on('logout', async ({ roomId, playerId }) => {
      const room = await roomsStorage.get(roomId);
      if (!room) return;
      
      if (room.hostId === playerId) {
        await markRoomInactive(io, roomId, 'The host has ended the room.');
      } else {
        // Just remove the player or mark them OUT
        if (room.players[playerId]) {
          room.players[playerId].connected = false;
          room.players[playerId].state = 'OUT';
          
          if (room.activeRound && room.activeRound.state === 'IN_PROGRESS') {
            const playingPlayers = Object.values(room.players).filter(pl => pl.state === 'PLAYING');
            if (playingPlayers.length <= 1) {
              room.activeRound.state = 'COMPLETED';
              if (playingPlayers.length === 1) {
                room.activeRound.winnerIds = [playingPlayers[0].id];
                room.activeRound.winReason = 'All other players packed or left';
                playingPlayers[0].wallet += room.activeRound.pot;
              }
            } else if (room.activeRound.currentTurnId === playerId) {
              room.activeRound.currentTurnId = getNextPlayer(room, playerId);
              room.activeRound.turnExpiry = Date.now() + 60000;
            }
          }
          
          await roomsStorage.set(roomId, room);
          broadcastRoomUpdate(io, roomId, room);
        }
      }
    });

    socket.on('disconnect', async () => {
      const rooms = await roomsStorage.getAll();
      for (const room of rooms) {
        if (room.status !== 'ACTIVE') continue;
        
        // Find which player disconnected
        let disconnectedPid = null;
        for (const pid of Object.keys(room.players)) {
          if (room.players[pid].socketId === socket.id) {
            disconnectedPid = pid;
            room.players[pid].connected = false;
          }
        }
        
        if (disconnectedPid) {
          await roomsStorage.set(room.id, room);
          broadcastRoomUpdate(io, room.id, room);
        }
      }
    });
  });
}

function broadcastRoomUpdate(io: Server, roomId: string, room: Room) {
  // Strip raw cards before broadcasting to all
  const sanitizedRoom = JSON.parse(JSON.stringify(room));
  const isRoundComplete = sanitizedRoom.activeRound && sanitizedRoom.activeRound.state === 'COMPLETED';
  if (sanitizedRoom.activeRound && !isRoundComplete) {
    sanitizedRoom.activeRound.deck = []; // hide deck
  }
  for (const pid in sanitizedRoom.players) {
    if (!isRoundComplete) {
      sanitizedRoom.players[pid].cards = []; // hide cards
    }
  }
  
  io.to(roomId).emit('room_update', sanitizedRoom);
  
  // Send private states
  for (const pid in room.players) {
    const player = room.players[pid];
    if (player.connected && player.socketId) {
       const cards = (player.seen || isRoundComplete) ? (player.cards || []) : [];
       io.to(player.socketId).emit('private_state', cards);
    }
  }
}
