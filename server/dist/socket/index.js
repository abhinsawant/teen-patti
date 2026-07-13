"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketHandlers = registerSocketHandlers;
const storage_1 = require("../storage");
const engine_1 = require("../game/engine");
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}
function getNextPlayer(room, currentId) {
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
function getPreviousPlayer(room, currentId) {
    const currentIndex = room.playerOrder.indexOf(currentId);
    for (let i = 1; i < room.playerOrder.length; i++) {
        let prevIndex = currentIndex - i;
        if (prevIndex < 0)
            prevIndex += room.playerOrder.length;
        const pid = room.playerOrder[prevIndex];
        if (room.players[pid].state === 'PLAYING') {
            return pid;
        }
    }
    return null;
}
async function markRoomInactive(io, roomId, reason) {
    const room = await storage_1.roomsStorage.get(roomId);
    if (room && room.status === 'ACTIVE') {
        room.status = 'ENDED';
        await storage_1.roomsStorage.set(roomId, room);
        io.to(roomId).emit('room_timeout', reason);
        io.in(roomId).socketsLeave(roomId);
    }
}
function registerSocketHandlers(io) {
    // Global inactivity and turn checker
    setInterval(async () => {
        const rooms = await storage_1.roomsStorage.getAll();
        for (const room of rooms) {
            if (room.status === 'ACTIVE') {
                const timeSinceLastActivity = Date.now() - room.lastActivityTime;
                if (timeSinceLastActivity > INACTIVITY_TIMEOUT_MS) {
                    await markRoomInactive(io, room.id, 'Room became inactive due to 5 minutes of no activity.');
                    continue;
                }
                // Turn Timer Auto-play
                if (room.activeRound && room.activeRound.state === 'IN_PROGRESS' && room.activeRound.turnExpiry && Date.now() > room.activeRound.turnExpiry) {
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
                            }
                            else {
                                room.activeRound.currentTurnId = getNextPlayer(room, pid);
                                room.activeRound.turnExpiry = Date.now() + 60000;
                            }
                        }
                        else {
                            // Auto-bet
                            const amount = player.seen ? room.activeRound.minimumBet * 2 : room.activeRound.minimumBet;
                            if (player.wallet >= amount) {
                                player.wallet -= amount;
                                player.betAmount += amount;
                                room.activeRound.pot += amount;
                            }
                            else {
                                player.state = 'PACKED'; // Not enough money, auto fold
                            }
                            const playingPlayers = Object.values(room.players).filter(p => p.state === 'PLAYING');
                            if (playingPlayers.length === 1) {
                                room.activeRound.state = 'COMPLETED';
                                room.activeRound.winnerIds = [playingPlayers[0].id];
                                room.activeRound.winReason = 'All other players packed';
                                playingPlayers[0].wallet += room.activeRound.pot;
                            }
                            else {
                                room.activeRound.currentTurnId = getNextPlayer(room, pid);
                                room.activeRound.turnExpiry = Date.now() + 60000;
                            }
                        }
                        room.lastActivityTime = Date.now();
                        await storage_1.roomsStorage.set(room.id, room);
                        broadcastRoomUpdate(io, room.id, room);
                    }
                }
            }
        }
    }, 2000); // Check every 2s
    io.on('connection', (socket) => {
        socket.on('create_room', async ({ playerName, avatar, playerId }) => {
            const rooms = await storage_1.roomsStorage.getAll();
            const activeRoom = rooms.find(r => r.status === 'ACTIVE');
            if (activeRoom) {
                socket.emit('error', 'An active room already exists.');
                return;
            }
            const roomId = generateRoomId();
            let id = playerId || Math.random().toString(36).substring(2, 9);
            const newRoom = {
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
                dealerId: '',
                locked: false,
                paused: false,
                pendingRebuys: [],
                status: 'ACTIVE',
                lastActivityTime: Date.now()
            };
            const newPlayer = {
                id,
                name: playerName,
                avatar,
                socketId: socket.id,
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
            await storage_1.roomsStorage.set(roomId, newRoom);
            socket.join(roomId);
            socket.emit('player_id_assigned', { playerId: id, roomId });
            broadcastRoomUpdate(io, roomId, newRoom);
        });
        socket.on('join_room', async ({ playerName, avatar, playerId }) => {
            // Find the single active room
            const rooms = await storage_1.roomsStorage.getAll();
            const room = rooms.find(r => r.status === 'ACTIVE');
            if (!room) {
                socket.emit('error', 'No active room found. Please create one.');
                return;
            }
            let id = playerId || Math.random().toString(36).substring(2, 9);
            // Name uniqueness check
            const isNameTaken = Object.values(room.players).some(p => p.name.toLowerCase() === playerName.toLowerCase() && p.id !== id);
            if (isNameTaken) {
                socket.emit('error', 'Name is already taken in this room.');
                return;
            }
            if (room.locked && !room.players[id]) {
                socket.emit('error', 'Room is locked');
                return;
            }
            socket.join(room.id);
            const newPlayer = room.players[id] || {
                id,
                name: playerName,
                avatar,
                socketId: socket.id,
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
            await storage_1.roomsStorage.set(room.id, room);
            socket.emit('player_id_assigned', { playerId: id, roomId: room.id });
            broadcastRoomUpdate(io, room.id, room);
        });
        socket.on('player_action', async ({ roomId, type, amount, targetId }) => {
            const room = await storage_1.roomsStorage.get(roomId);
            if (!room || room.status !== 'ACTIVE')
                return;
            const p = Object.values(room.players).find(p => p.socketId === socket.id);
            if (!p)
                return;
            room.lastActivityTime = Date.now();
            if (type === 'START_GAME') {
                if (room.hostId !== p.id || Object.keys(room.players).length < 2)
                    return;
                let deck = (0, engine_1.shuffle)((0, engine_1.createDeck)());
                let playingIds = room.playerOrder.filter(pid => room.players[pid].connected && room.players[pid].wallet >= room.config.startingBlind);
                if (playingIds.length < 2)
                    return; // Need at least 2 players with money
                // Reset players
                for (const pid of playingIds) {
                    room.players[pid].state = 'PLAYING';
                    room.players[pid].seen = false;
                    room.players[pid].betAmount = room.config.startingBlind;
                    room.players[pid].wallet -= room.config.startingBlind; // Collect boot
                    room.players[pid].missedTurns = 0;
                }
                // Deal cards
                const hands = (0, engine_1.dealCards)(deck, playingIds.length);
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
                    if (round.currentTurnId !== p.id)
                        return;
                    p.missedTurns = 0; // Reset strikes
                    if (type === 'PACK') {
                        p.state = 'PACKED';
                    }
                    else if (type === 'BLIND' || type === 'CHAAL') {
                        if (p.wallet >= amount) {
                            p.wallet -= amount;
                            p.betAmount += amount;
                            round.pot += amount;
                            if (!p.seen) {
                                round.minimumBet = amount;
                            }
                            else {
                                round.minimumBet = amount / 2;
                            }
                        }
                        else {
                            p.state = 'PACKED';
                        }
                    }
                    else if (type === 'SIDE_SHOW') {
                        const prev = getPreviousPlayer(room, p.id);
                        if (prev) {
                            round.pendingSideShow = { requesterId: p.id, targetId: prev };
                            round.currentTurnId = prev; // Target must respond
                            round.turnExpiry = Date.now() + 60000;
                        }
                    }
                    else if (type === 'ACCEPT_SIDE_SHOW') {
                        if (round.pendingSideShow && round.pendingSideShow.targetId === p.id) {
                            round.resolvingSideShow = round.pendingSideShow;
                            round.pendingSideShow = undefined;
                            // We pause for a moment
                            round.currentTurnId = null;
                            await storage_1.roomsStorage.set(roomId, room);
                            broadcastRoomUpdate(io, roomId, room);
                            // Broadcast both players cards privately to each other
                            const reqPlayer = room.players[round.resolvingSideShow.requesterId];
                            const tgtPlayer = room.players[round.resolvingSideShow.targetId];
                            if (reqPlayer.socketId)
                                io.to(reqPlayer.socketId).emit('private_state', tgtPlayer.cards);
                            if (tgtPlayer.socketId)
                                io.to(tgtPlayer.socketId).emit('private_state', reqPlayer.cards);
                            setTimeout(async () => {
                                const refreshedRoom = await storage_1.roomsStorage.get(roomId);
                                if (!refreshedRoom || !refreshedRoom.activeRound)
                                    return;
                                const r = refreshedRoom.activeRound;
                                const resolving = r.resolvingSideShow;
                                if (!resolving)
                                    return;
                                const req = refreshedRoom.players[resolving.requesterId];
                                const tgt = refreshedRoom.players[resolving.targetId];
                                const cmp = (0, engine_1.compareHands)(req.cards, tgt.cards);
                                if (cmp > 0) {
                                    tgt.state = 'PACKED';
                                }
                                else {
                                    req.state = 'PACKED'; // If tie, requester loses
                                }
                                // Turn goes back to requester (if they survived) or next person
                                r.currentTurnId = getNextPlayer(refreshedRoom, tgt.id);
                                r.turnExpiry = Date.now() + 60000;
                                r.resolvingSideShow = undefined;
                                await storage_1.roomsStorage.set(roomId, refreshedRoom);
                                broadcastRoomUpdate(io, roomId, refreshedRoom);
                                // Resend proper private states
                                if (req.socketId)
                                    io.to(req.socketId).emit('private_state', req.cards);
                                if (tgt.socketId)
                                    io.to(tgt.socketId).emit('private_state', tgt.cards);
                            }, 4000);
                            return; // We return early because of setTimeout
                        }
                    }
                    else if (type === 'DECLINE_SIDE_SHOW') {
                        if (round.pendingSideShow && round.pendingSideShow.targetId === p.id) {
                            round.currentTurnId = getNextPlayer(room, round.pendingSideShow.targetId);
                            round.turnExpiry = Date.now() + 60000;
                            round.pendingSideShow = undefined;
                        }
                    }
                    else if (type === 'SHOW') {
                        if (p.wallet >= amount) {
                            p.wallet -= amount;
                            p.betAmount += amount;
                            round.pot += amount;
                            const playingPlayers = Object.values(room.players).filter(pl => pl.state === 'PLAYING');
                            if (playingPlayers.length === 2) {
                                const cmp = (0, engine_1.compareHands)(playingPlayers[0].cards, playingPlayers[1].cards);
                                const winner = cmp > 0 ? playingPlayers[0] : playingPlayers[1];
                                const loser = cmp > 0 ? playingPlayers[1] : playingPlayers[0];
                                round.state = 'COMPLETED';
                                round.winnerIds = [winner.id];
                                const winEval = (0, engine_1.evaluateHand)(winner.cards);
                                round.winReason = (0, engine_1.handTypeToString)(winEval.type);
                                winner.wallet += round.pot;
                            }
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
                        }
                        else if (type !== 'ACCEPT_SIDE_SHOW') {
                            round.currentTurnId = getNextPlayer(room, p.id);
                            round.turnExpiry = Date.now() + 60000;
                        }
                    }
                }
            }
            await storage_1.roomsStorage.set(roomId, room);
            broadcastRoomUpdate(io, roomId, room);
        });
        socket.on('chat_message', async ({ roomId, senderId, senderName, text }) => {
            const room = await storage_1.roomsStorage.get(roomId);
            if (!room)
                return;
            const message = {
                id: Math.random().toString(36).substring(2, 9),
                senderId,
                senderName,
                text,
                timestamp: Date.now()
            };
            io.to(roomId).emit('chat_message', message);
        });
        socket.on('logout', async ({ roomId, playerId }) => {
            const room = await storage_1.roomsStorage.get(roomId);
            if (!room)
                return;
            if (room.hostId === playerId) {
                await markRoomInactive(io, roomId, 'The host has ended the room.');
            }
            else {
                // Just remove the player or mark them OUT
                if (room.players[playerId]) {
                    room.players[playerId].connected = false;
                    room.players[playerId].state = 'OUT';
                    await storage_1.roomsStorage.set(roomId, room);
                    broadcastRoomUpdate(io, roomId, room);
                }
            }
        });
        socket.on('disconnect', async () => {
            const rooms = await storage_1.roomsStorage.getAll();
            for (const room of rooms) {
                if (room.status !== 'ACTIVE')
                    continue;
                // Find which player disconnected
                let disconnectedPid = null;
                for (const pid of Object.keys(room.players)) {
                    if (room.players[pid].socketId === socket.id) {
                        disconnectedPid = pid;
                        room.players[pid].connected = false;
                    }
                }
                if (disconnectedPid) {
                    if (room.hostId === disconnectedPid) {
                        // Host disconnected!
                        await markRoomInactive(io, room.id, 'The host disconnected.');
                    }
                    else {
                        await storage_1.roomsStorage.set(room.id, room);
                        broadcastRoomUpdate(io, room.id, room);
                    }
                }
            }
        });
    });
}
function broadcastRoomUpdate(io, roomId, room) {
    // Strip raw cards before broadcasting to all
    const sanitizedRoom = JSON.parse(JSON.stringify(room));
    if (sanitizedRoom.activeRound) {
        sanitizedRoom.activeRound.deck = []; // hide deck
    }
    for (const pid in sanitizedRoom.players) {
        sanitizedRoom.players[pid].cards = []; // hide cards
    }
    io.to(roomId).emit('room_update', sanitizedRoom);
    // Send private states
    for (const pid in room.players) {
        const player = room.players[pid];
        if (player.connected && player.socketId) {
            io.to(player.socketId).emit('private_state', player.cards || []);
        }
    }
}
