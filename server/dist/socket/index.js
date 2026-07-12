"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketHandlers = registerSocketHandlers;
const storage_1 = require("../storage");
const engine_1 = require("../game/engine");
const turnTimeouts = new Map();
function registerSocketHandlers(io, socket) {
    const broadcastRoomUpdate = async (roomId) => {
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room)
            return;
        // Send sanitized room state to everyone
        const sanitizedRoom = { ...room, players: {} };
        const isCompleted = room.activeRound?.state === 'COMPLETED';
        for (const [pid, p] of Object.entries(room.players)) {
            sanitizedRoom.players[pid] = { ...p, cards: isCompleted ? p.cards : [] }; // Reveal cards only at round end
        }
        if (sanitizedRoom.activeRound) {
            sanitizedRoom.activeRound = { ...sanitizedRoom.activeRound, deck: [] }; // Hide deck
        }
        io.to(roomId).emit('room_update', sanitizedRoom);
        if (room.activeRound) {
            for (const [playerId, player] of Object.entries(room.players)) {
                if (player.socketId) {
                    const cardsToSend = player.seen ? (player.cards || []) : [];
                    io.to(player.socketId).emit('private_state', cardsToSend);
                }
            }
        }
    };
    socket.on('join_room', async (roomId, playerName, avatar, existingPlayerId) => {
        roomId = roomId.toUpperCase();
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room) {
            socket.emit('error', 'Kitchen not found');
            return;
        }
        let playerId = existingPlayerId || Math.random().toString(36).substring(2, 9);
        if (room.players[playerId]) {
            // Rejoining
            room.players[playerId].socketId = socket.id;
            room.players[playerId].connected = true;
            room.players[playerId].avatar = avatar;
        }
        else {
            const existingPlayerByName = Object.values(room.players).find(p => p.name.toLowerCase() === playerName.toLowerCase());
            if (existingPlayerByName) {
                if (!existingPlayerByName.connected) {
                    // Reclaim disconnected player slot
                    playerId = existingPlayerByName.id;
                    room.players[playerId].socketId = socket.id;
                    room.players[playerId].connected = true;
                    room.players[playerId].avatar = avatar;
                    socket.emit('player_id_assigned', playerId);
                }
                else {
                    socket.emit('error', 'A player with this name is currently active in the room.');
                    return;
                }
            }
            else {
                if (room.locked) {
                    socket.emit('error', 'Kitchen is currently locked by the host.');
                    return;
                }
                if (Object.keys(room.players).length >= 15) {
                    socket.emit('error', 'Kitchen is full.');
                    return;
                }
                const newPlayer = {
                    id: playerId,
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
                    betAmount: 0
                };
                room.players[playerId] = newPlayer;
                room.playerOrder.push(playerId);
                socket.emit('player_id_assigned', playerId);
            }
        }
        room.lastActivityTime = Date.now();
        await storage_1.roomsStorage.set(roomId, room);
        socket.join(roomId);
        // Store metadata on socket
        socket.data.roomId = roomId;
        socket.data.playerId = playerId;
        await broadcastRoomUpdate(roomId);
    });
    socket.on('start_game', async () => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room)
            return;
        if (room.hostId !== playerId) {
            socket.emit('notification', 'Only the host can start the game.');
            return;
        }
        if (room.status === 'ENDED') {
            // Create new session logic
        }
        // reset round
        const activePlayers = room.playerOrder.filter(id => room.players[id].wallet >= room.config.startingBlind && room.players[id].connected);
        if (activePlayers.length < 2) {
            socket.emit('notification', 'Need at least 2 players with enough balance to start.');
            return;
        }
        // Dealer rotation
        if (!room.dealerId) {
            room.dealerId = activePlayers[0];
        }
        else {
            const dealerIdx = room.playerOrder.indexOf(room.dealerId);
            for (let i = 1; i < room.playerOrder.length; i++) {
                const nextIdx = (dealerIdx + i) % room.playerOrder.length;
                if (activePlayers.includes(room.playerOrder[nextIdx])) {
                    room.dealerId = room.playerOrder[nextIdx];
                    break;
                }
            }
        }
        // First turn is player to the left of dealer
        let firstTurnId = activePlayers[0];
        const dealerIdx = room.playerOrder.indexOf(room.dealerId);
        for (let i = 1; i < room.playerOrder.length; i++) {
            const nextIdx = (dealerIdx + i) % room.playerOrder.length;
            if (activePlayers.includes(room.playerOrder[nextIdx])) {
                firstTurnId = room.playerOrder[nextIdx];
                break;
            }
        }
        const deck = (0, engine_1.shuffle)((0, engine_1.createDeck)());
        const { hands, remainingDeck } = (0, engine_1.dealCards)(deck, activePlayers.length);
        activePlayers.forEach((id, idx) => {
            room.players[id].cards = hands[idx];
            room.players[id].state = 'PLAYING';
            room.players[id].seen = false;
            room.players[id].betAmount = room.config.startingBlind;
            room.players[id].wallet -= room.config.startingBlind;
        });
        const turnExpiry = Date.now() + 60000;
        room.activeRound = {
            id: Math.random().toString(36).substring(2, 9),
            state: 'IN_PROGRESS',
            pot: activePlayers.length * room.config.startingBlind,
            currentTurnId: firstTurnId,
            turnExpiry,
            minimumBet: room.config.startingBlind,
            winnerIds: [],
            deck: remainingDeck,
            actionLog: ['Game started, blinds placed.']
        };
        startTurnTimer(roomId, firstTurnId, room.activeRound.id);
        room.lastActivityTime = Date.now();
        await storage_1.roomsStorage.set(roomId, room);
        await broadcastRoomUpdate(roomId);
    });
    const advanceTurn = async (roomId, room) => {
        const playing = room.playerOrder.filter(id => room.players[id].state === 'PLAYING');
        if (playing.length === 1) {
            room.activeRound.state = 'COMPLETED';
            room.activeRound.winnerIds = [playing[0]];
            room.activeRound.winReason = 'All other players packed';
            room.players[playing[0]].wallet += room.activeRound.pot;
            room.players[playing[0]].won += room.activeRound.pot;
            room.activeRound.actionLog.push(`${room.players[playing[0]].name} won ₹${room.activeRound.pot}!`);
            room.activeRound.currentTurnId = null;
            if (turnTimeouts.has(roomId)) {
                clearTimeout(turnTimeouts.get(roomId));
            }
        }
        else if (playing.length > 1 && room.activeRound) {
            const originalIdx = room.playerOrder.indexOf(room.activeRound.currentTurnId);
            for (let i = 1; i < room.playerOrder.length; i++) {
                const nextIdx = (originalIdx + i) % room.playerOrder.length;
                if (room.players[room.playerOrder[nextIdx]].state === 'PLAYING') {
                    room.activeRound.currentTurnId = room.playerOrder[nextIdx];
                    break;
                }
            }
            room.activeRound.turnExpiry = Date.now() + 60000;
            startTurnTimer(roomId, room.activeRound.currentTurnId, room.activeRound.id);
        }
        await storage_1.roomsStorage.set(roomId, room);
        await broadcastRoomUpdate(roomId);
    };
    const startTurnTimer = (roomId, playerId, roundId) => {
        if (turnTimeouts.has(roomId)) {
            clearTimeout(turnTimeouts.get(roomId));
        }
        const timeout = setTimeout(async () => {
            const room = await storage_1.roomsStorage.get(roomId);
            if (!room || !room.activeRound || room.activeRound.id !== roundId)
                return;
            if (room.paused)
                return; // If paused, ignore timer
            if (room.activeRound.currentTurnId === playerId) {
                if (room.activeRound.pendingSideShow) {
                    const { targetId } = room.activeRound.pendingSideShow;
                    room.activeRound.actionLog.push(`${room.players[targetId].name} auto-denied Side Show (timeout).`);
                    room.activeRound.pendingSideShow = undefined;
                    await advanceTurn(roomId, room);
                    return;
                }
                const player = room.players[playerId];
                if (!player.connected) {
                    player.state = 'PACKED';
                    room.activeRound.actionLog.push(`${player.name} auto-packed (disconnected).`);
                }
                else {
                    const isBlind = !player.seen;
                    const cost = isBlind ? room.activeRound.minimumBet : room.activeRound.minimumBet * 2;
                    if (player.wallet >= cost) {
                        player.wallet -= cost;
                        player.betAmount += cost;
                        room.activeRound.pot += cost;
                        room.activeRound.actionLog.push(`${player.name} auto-played ${isBlind ? 'Blind' : 'Chaal'} (₹${cost}) due to timeout.`);
                        io.to(roomId).emit('animate_coin', { fromPlayerId: playerId, amount: cost });
                    }
                    else {
                        player.state = 'PACKED';
                        room.activeRound.actionLog.push(`${player.name} auto-packed (timeout - insufficient funds).`);
                    }
                }
                await advanceTurn(roomId, room);
            }
        }, 60000);
        turnTimeouts.set(roomId, timeout);
    };
    const handleBet = async (socket, actionName, isBlind, customAmount) => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || !room.activeRound)
            return;
        if (room.activeRound.currentTurnId !== playerId) {
            socket.emit('notification', 'Not your turn!');
            return;
        }
        const player = room.players[playerId];
        let cost = isBlind ? room.activeRound.minimumBet : room.activeRound.minimumBet * 2;
        if (customAmount !== undefined) {
            if (customAmount <= cost) {
                socket.emit('notification', 'Raise amount must be greater than current call amount.');
                return;
            }
            const stepRequired = isBlind ? room.config.startingBlind : room.config.startingBlind * 2;
            if (customAmount % stepRequired !== 0) {
                socket.emit('notification', `Raise amount must be a multiple of ${stepRequired}`);
                return;
            }
            cost = customAmount;
            room.activeRound.minimumBet = isBlind ? cost : cost / 2;
        }
        if (player.wallet < cost) {
            socket.emit('notification', 'Insufficient balance');
            return;
        }
        player.wallet -= cost;
        player.betAmount += cost;
        room.activeRound.pot += cost;
        room.activeRound.actionLog.push(`${player.name} played ${actionName} (₹${cost}).`);
        // Broadcast animate_coin
        io.to(roomId).emit('animate_coin', { fromPlayerId: playerId, amount: cost });
        // If it's a raise, notify other players
        if (actionName === 'Raise') {
            socket.to(roomId).emit('notification', `${player.name} raised to ₹${cost}!`);
        }
        // Temporarily clear currentTurnId so UI locks for 1s
        const originalTurnId = room.activeRound.currentTurnId;
        room.activeRound.currentTurnId = null;
        room.lastActivityTime = Date.now();
        await storage_1.roomsStorage.set(roomId, room);
        await broadcastRoomUpdate(roomId);
        setTimeout(async () => {
            const currentRoom = await storage_1.roomsStorage.get(roomId);
            if (!currentRoom || !currentRoom.activeRound)
                return;
            currentRoom.activeRound.currentTurnId = originalTurnId; // restore so advanceTurn knows who played last
            await advanceTurn(roomId, currentRoom);
        }, 1000);
    };
    socket.on('action_blind', () => handleBet(socket, 'Blind', true));
    socket.on('action_chaal', () => handleBet(socket, 'Chaal', false));
    socket.on('action_raise', async (amount) => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room)
            return;
        const isBlind = !room.players[playerId].seen;
        await handleBet(socket, 'Raise', isBlind, amount);
    });
    socket.on('action_show', async () => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || !room.activeRound)
            return;
        if (room.activeRound.currentTurnId !== playerId) {
            socket.emit('notification', 'Not your turn!');
            return;
        }
        const playing = room.playerOrder.filter(id => room.players[id].state === 'PLAYING');
        if (playing.length !== 2) {
            socket.emit('notification', 'Show is only allowed when exactly 2 players remain. Use Side Show if more players are left.');
            return;
        }
        const player = room.players[playerId];
        const otherPlayerId = playing.find(id => id !== playerId);
        const otherPlayer = room.players[otherPlayerId];
        const baseCost = player.seen ? room.activeRound.minimumBet * 2 : room.activeRound.minimumBet;
        const cost = baseCost * 2;
        if (player.wallet < cost) {
            socket.emit('notification', 'Insufficient balance for Show');
            return;
        }
        player.wallet -= cost;
        player.betAmount += cost;
        room.activeRound.pot += cost;
        room.activeRound.actionLog.push(`${player.name} asked for a Show (₹${cost}).`);
        // Broadcast animate_coin
        io.to(roomId).emit('animate_coin', { fromPlayerId: playerId, amount: cost });
        const p1Id = playing[0];
        const p2Id = playing[1];
        const res = (0, engine_1.compareHands)(room.players[p1Id].cards, room.players[p2Id].cards);
        let winnerId = res > 0 ? p1Id : p2Id;
        if (res === 0)
            winnerId = p1Id === playerId ? p2Id : p1Id;
        room.activeRound.state = 'COMPLETED';
        room.activeRound.winnerIds = [winnerId];
        room.activeRound.winReason = (0, engine_1.handTypeToString)((0, engine_1.evaluateHand)(room.players[winnerId].cards).type);
        room.activeRound.currentTurnId = null;
        room.players[winnerId].wallet += room.activeRound.pot;
        room.players[winnerId].won += room.activeRound.pot;
        room.activeRound.actionLog.push(`${room.players[winnerId].name} won the show!`);
        room.lastActivityTime = Date.now();
        await storage_1.roomsStorage.set(roomId, room);
        await broadcastRoomUpdate(roomId);
    });
    socket.on('action_sideshow', async (targetPlayerId) => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || !room.activeRound)
            return;
        if (room.activeRound.currentTurnId !== playerId)
            return;
        const playing = room.playerOrder.filter(id => room.players[id].state === 'PLAYING');
        if (playing.length <= 2) {
            socket.emit('notification', 'Side Show requires at least 3 players. Use Show instead.');
            return;
        }
        const player = room.players[playerId];
        const targetPlayer = room.players[targetPlayerId];
        if (!targetPlayer || targetPlayer.state !== 'PLAYING')
            return;
        if (!player.seen || !targetPlayer.seen) {
            socket.emit('notification', 'Both players must be Seen to request a Side Show.');
            return;
        }
        const cost = room.activeRound.minimumBet * 4; // pot X2 amount from current (chaal is min*2)
        if (player.wallet < cost) {
            socket.emit('notification', 'Insufficient balance for Side Show');
            return;
        }
        room.activeRound.pendingSideShow = { requesterId: playerId, targetId: targetPlayerId };
        room.activeRound.actionLog.push(`${player.name} requested a Side Show with ${targetPlayer.name} (Requires ₹${cost}).`);
        room.lastActivityTime = Date.now();
        await storage_1.roomsStorage.set(roomId, room);
        await broadcastRoomUpdate(roomId);
    });
    socket.on('action_sideshow_accept', async () => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || !room.activeRound || !room.activeRound.pendingSideShow)
            return;
        const { requesterId, targetId } = room.activeRound.pendingSideShow;
        if (playerId !== targetId)
            return;
        const p1 = room.players[requesterId];
        const p2 = room.players[targetId];
        room.activeRound.actionLog.push(`${p2.name} accepted the Side Show.`);
        const cost = room.activeRound.minimumBet * 4;
        p1.wallet -= cost;
        p1.betAmount += cost;
        room.activeRound.pot += cost;
        room.activeRound.actionLog.push(`${p1.name} paid ₹${cost} for the Side Show.`);
        // Broadcast animate_coin for the side show payment
        io.to(roomId).emit('animate_coin', { fromPlayerId: requesterId, amount: cost });
        const res = (0, engine_1.compareHands)(p1.cards, p2.cards);
        // If res === 0, the requester (p1) loses
        let loserId = res > 0 ? targetId : requesterId;
        if (res === 0)
            loserId = requesterId;
        room.players[loserId].state = 'PACKED';
        room.activeRound.actionLog.push(`${room.players[loserId].name} packed as a result of Side Show.`);
        room.activeRound.pendingSideShow = undefined;
        // Check if only one player is left after packing
        const playing = room.playerOrder.filter(id => room.players[id].state === 'PLAYING');
        if (playing.length === 1) {
            room.activeRound.state = 'COMPLETED';
            room.activeRound.winnerIds = [playing[0]];
            room.activeRound.currentTurnId = null;
            room.players[playing[0]].wallet += room.activeRound.pot;
            room.players[playing[0]].won += room.activeRound.pot;
            room.activeRound.actionLog.push(`${room.players[playing[0]].name} won the pot of ₹${room.activeRound.pot}!`);
            room.lastActivityTime = Date.now();
            await storage_1.roomsStorage.set(roomId, room);
            await broadcastRoomUpdate(roomId);
        }
        else {
            // Temporarily clear currentTurnId so UI locks for 1s
            const originalTurnId = room.activeRound.currentTurnId;
            room.activeRound.currentTurnId = null;
            room.lastActivityTime = Date.now();
            await storage_1.roomsStorage.set(roomId, room);
            await broadcastRoomUpdate(roomId);
            setTimeout(async () => {
                const currentRoom = await storage_1.roomsStorage.get(roomId);
                if (!currentRoom || !currentRoom.activeRound)
                    return;
                currentRoom.activeRound.currentTurnId = originalTurnId; // restore
                await advanceTurn(roomId, currentRoom); // advance turn to next player after the requester
            }, 1000);
        }
    });
    socket.on('action_sideshow_deny', async () => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || !room.activeRound || !room.activeRound.pendingSideShow)
            return;
        const { targetId } = room.activeRound.pendingSideShow;
        if (playerId !== targetId)
            return;
        room.activeRound.actionLog.push(`${room.players[targetId].name} denied the Side Show.`);
        room.activeRound.pendingSideShow = undefined;
        await advanceTurn(roomId, room);
    });
    socket.on('action_pack', async () => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || !room.activeRound)
            return;
        if (room.activeRound.currentTurnId !== playerId)
            return;
        room.players[playerId].state = 'PACKED';
        room.activeRound.actionLog.push(`${room.players[playerId].name} packed.`);
        await advanceTurn(roomId, room);
    });
    socket.on('action_see', async () => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || !room.activeRound)
            return;
        if (room.players[playerId] && !room.players[playerId].seen) {
            room.players[playerId].seen = true;
            room.activeRound.actionLog.push(`${room.players[playerId].name} has seen their cards.`);
            room.lastActivityTime = Date.now();
            await storage_1.roomsStorage.set(roomId, room);
            await broadcastRoomUpdate(roomId);
        }
    });
    socket.on('action_rebuy', async () => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room)
            return;
        const player = room.players[playerId];
        if (player.rebuys >= room.config.maxRebuys) {
            socket.emit('notification', 'Maximum rebuys reached.');
            return;
        }
        if (room.config.autoApprove) {
            player.wallet += room.config.rebuyAmount;
            player.invested += room.config.rebuyAmount;
            player.rebuys += 1;
            room.lastActivityTime = Date.now();
            await storage_1.roomsStorage.set(roomId, room);
            await broadcastRoomUpdate(roomId);
        }
        else {
            if (!room.pendingRebuys)
                room.pendingRebuys = [];
            if (!room.pendingRebuys.includes(playerId)) {
                room.pendingRebuys.push(playerId);
                room.lastActivityTime = Date.now();
                await storage_1.roomsStorage.set(roomId, room);
                await broadcastRoomUpdate(roomId);
                socket.emit('notification', 'Rebuy requested. Waiting for host approval.');
            }
            else {
                socket.emit('notification', 'Rebuy request already pending.');
            }
        }
    });
    socket.on('update_config', async (newConfig) => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room)
            return;
        if (room.hostId !== playerId)
            return;
        room.config = { ...room.config, ...newConfig };
        room.lastActivityTime = Date.now();
        await storage_1.roomsStorage.set(roomId, room);
        await broadcastRoomUpdate(roomId);
    });
    socket.on('end_session', async () => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room)
            return;
        if (room.hostId !== playerId)
            return;
        room.status = 'ENDED';
        // Calculate settlement
        const debtors = Object.values(room.players).filter(p => (p.wallet - p.invested) < 0).sort((a, b) => (a.wallet - a.invested) - (b.wallet - b.invested));
        const creditors = Object.values(room.players).filter(p => (p.wallet - p.invested) > 0).sort((a, b) => (b.wallet - b.invested) - (a.wallet - a.invested));
        const settlements = [];
        let dIdx = 0;
        let cIdx = 0;
        const dBalances = debtors.map(d => Math.abs(d.wallet - d.invested));
        const cBalances = creditors.map(c => c.wallet - c.invested);
        while (dIdx < debtors.length && cIdx < creditors.length) {
            const d = debtors[dIdx];
            const c = creditors[cIdx];
            const amount = Math.min(dBalances[dIdx], cBalances[cIdx]);
            if (amount > 0) {
                settlements.push({ fromId: d.id, toId: c.id, amount });
            }
            dBalances[dIdx] -= amount;
            cBalances[cIdx] -= amount;
            if (dBalances[dIdx] <= 0.01)
                dIdx++;
            if (cBalances[cIdx] <= 0.01)
                cIdx++;
        }
        room.settlements = settlements;
        // Construct SessionReceipt
        const receiptPlayers = {};
        for (const [pId, p] of Object.entries(room.players)) {
            receiptPlayers[pId] = {
                id: pId,
                name: p.name,
                avatar: p.avatar,
                wallet: p.wallet,
                invested: p.invested,
                netProfit: p.wallet - p.invested
            };
        }
        const receipt = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
            roomId: room.id,
            date: Date.now(),
            hostId: room.hostId,
            players: receiptPlayers,
            settlements: settlements
        };
        await storage_1.settlementsStorage.set(receipt.id, receipt);
        room.lastActivityTime = Date.now();
        await storage_1.roomsStorage.set(roomId, room);
        await broadcastRoomUpdate(roomId);
    });
    socket.on('host_lock_toggle', async () => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || room.hostId !== playerId)
            return;
        room.locked = !room.locked;
        room.lastActivityTime = Date.now();
        await storage_1.roomsStorage.set(roomId, room);
        await broadcastRoomUpdate(roomId);
    });
    socket.on('host_kick', async (targetId) => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || room.hostId !== playerId || targetId === playerId)
            return;
        if (room.players[targetId]) {
            const wasTurn = room.activeRound?.currentTurnId === targetId;
            room.players[targetId].state = 'OUT';
            room.players[targetId].connected = false;
            const targetSocketId = room.players[targetId].socketId;
            if (targetSocketId) {
                io.to(targetSocketId).emit('error', 'You have been kicked from the kitchen by the host.');
            }
            if (room.activeRound && room.activeRound.state === 'IN_PROGRESS') {
                if (wasTurn) {
                    await advanceTurn(roomId, room);
                }
                else {
                    const playing = room.playerOrder.filter(id => room.players[id].state === 'PLAYING' && id !== targetId);
                    if (playing.length === 1) {
                        room.activeRound.state = 'COMPLETED';
                        room.activeRound.winnerIds = [playing[0]];
                        room.activeRound.winReason = 'All other players packed';
                        room.players[playing[0]].wallet += room.activeRound.pot;
                        room.players[playing[0]].won += room.activeRound.pot;
                        room.activeRound.actionLog.push(`${room.players[playing[0]].name} won ₹${room.activeRound.pot}!`);
                        room.activeRound.currentTurnId = null;
                        if (turnTimeouts.has(roomId)) {
                            clearTimeout(turnTimeouts.get(roomId));
                        }
                    }
                }
            }
            room.playerOrder = room.playerOrder.filter(id => id !== targetId);
            room.lastActivityTime = Date.now();
            await storage_1.roomsStorage.set(roomId, room);
            await broadcastRoomUpdate(roomId);
        }
    });
    socket.on('host_transfer', async (targetId) => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || room.hostId !== playerId)
            return;
        if (room.players[targetId]) {
            room.hostId = targetId;
            room.lastActivityTime = Date.now();
            await storage_1.roomsStorage.set(roomId, room);
            await broadcastRoomUpdate(roomId);
        }
    });
    socket.on('host_pause_toggle', async () => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || room.hostId !== playerId)
            return;
        if (!room.paused) {
            room.paused = true;
            room.pauseStartTime = Date.now();
            room.activeRound?.actionLog.push('Game paused by host.');
            if (turnTimeouts.has(roomId)) {
                clearTimeout(turnTimeouts.get(roomId));
                turnTimeouts.delete(roomId);
            }
        }
        else {
            room.paused = false;
            room.pauseStartTime = undefined;
            room.activeRound?.actionLog.push('Game resumed.');
            if (room.activeRound && room.activeRound.currentTurnId) {
                room.activeRound.turnExpiry = Date.now() + 60000;
                startTurnTimer(roomId, room.activeRound.currentTurnId, room.activeRound.id);
            }
        }
        room.lastActivityTime = Date.now();
        await storage_1.roomsStorage.set(roomId, room);
        await broadcastRoomUpdate(roomId);
    });
    socket.on('host_approve_rebuy', async (targetId) => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || room.hostId !== playerId)
            return;
        if (room.pendingRebuys.includes(targetId)) {
            room.pendingRebuys = room.pendingRebuys.filter(id => id !== targetId);
            const target = room.players[targetId];
            if (target) {
                target.wallet += room.config.rebuyAmount;
                target.invested += room.config.rebuyAmount;
                target.rebuys += 1;
            }
            await storage_1.roomsStorage.set(roomId, room);
            await broadcastRoomUpdate(roomId);
        }
    });
    socket.on('host_deny_rebuy', async (targetId) => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || room.hostId !== playerId)
            return;
        if (room.pendingRebuys.includes(targetId)) {
            room.pendingRebuys = room.pendingRebuys.filter(id => id !== targetId);
            const targetSocketId = room.players[targetId]?.socketId;
            if (targetSocketId) {
                io.to(targetSocketId).emit('notification', 'Your rebuy request was denied by the host.');
            }
            await storage_1.roomsStorage.set(roomId, room);
            await broadcastRoomUpdate(roomId);
        }
    });
    socket.on('disconnect', async () => {
        const { roomId, playerId } = socket.data;
        if (roomId && playerId) {
            const room = await storage_1.roomsStorage.get(roomId);
            if (room && room.players[playerId]) {
                if (room.players[playerId].socketId === socket.id) {
                    room.players[playerId].connected = false;
                    room.lastActivityTime = Date.now();
                    await storage_1.roomsStorage.set(roomId, room);
                    await broadcastRoomUpdate(roomId);
                }
            }
        }
    });
}
