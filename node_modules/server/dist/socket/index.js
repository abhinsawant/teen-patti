"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketHandlers = registerSocketHandlers;
const storage_1 = require("../storage");
const engine_1 = require("../game/engine");
function registerSocketHandlers(io, socket) {
    const broadcastRoomUpdate = async (roomId) => {
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room)
            return;
        // Send sanitized room state to everyone
        const sanitizedRoom = { ...room };
        if (sanitizedRoom.activeRound) {
            sanitizedRoom.activeRound = { ...sanitizedRoom.activeRound, deck: [] }; // Hide deck
        }
        io.to(roomId).emit('room_update', sanitizedRoom);
        // Send private state to each player
        if (room.activeRound) {
            for (const [playerId, player] of Object.entries(room.players)) {
                if (player.socketId) {
                    io.to(player.socketId).emit('private_state', player.cards || []);
                }
            }
        }
    };
    socket.on('join_room', async (roomId, playerName, existingPlayerId) => {
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
            room.players[playerId].name = playerName; // Update name just in case
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
                socketId: socket.id,
                connected: true,
                wallet: room.config.buyIn, // They get the buy-in initially (would deduct from real wallet, but this is simple)
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
        }
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
            socket.emit('error', 'Only the host can start the game.');
            return;
        }
        const activePlayers = room.playerOrder.filter(id => room.players[id].wallet >= room.config.startingBlind);
        if (activePlayers.length < 2) {
            socket.emit('error', 'Need at least 2 players with enough balance to start.');
            return;
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
        room.activeRound = {
            id: Math.random().toString(36).substring(2, 9),
            state: 'IN_PROGRESS',
            pot: activePlayers.length * room.config.startingBlind,
            currentTurnId: activePlayers[0],
            minimumBet: room.config.startingBlind,
            winnerIds: [],
            deck: remainingDeck,
            actionLog: ['Game started, blinds placed.']
        };
        await storage_1.roomsStorage.set(roomId, room);
        await broadcastRoomUpdate(roomId);
    });
    // Other actions (blind, chaal, pack, show, sideshow) would go here...
    // For the sake of time in this iteration, I'll provide a skeleton for pack:
    socket.on('action_pack', async () => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId)
            return;
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || !room.activeRound)
            return;
        if (room.activeRound.currentTurnId !== playerId) {
            socket.emit('error', 'Not your turn!');
            return;
        }
        room.players[playerId].state = 'PACKED';
        room.activeRound.actionLog.push(`${room.players[playerId].name} packed.`);
        // Advance turn (simple)
        const playing = room.playerOrder.filter(id => room.players[id].state === 'PLAYING');
        if (playing.length === 1) {
            // Winner!
            room.activeRound.state = 'COMPLETED';
            room.activeRound.winnerIds = [playing[0]];
            room.players[playing[0]].wallet += room.activeRound.pot;
            room.players[playing[0]].won += room.activeRound.pot;
            room.activeRound.actionLog.push(`${room.players[playing[0]].name} won!`);
        }
        else {
            const currentIdx = playing.indexOf(playerId); // wait, it's packed now
            // Real turn logic is a bit more complex, but let's keep it simple
            const allActive = room.playerOrder.filter(id => room.players[id].state !== 'PACKED' && room.players[id].state !== 'OUT' && room.players[id].state !== 'WAITING');
            let nextTurnIdx = allActive.findIndex(id => id === playerId) + 1; // Wait, playerId is already packed.
            // Let's just find the next playing player
            const originalIdx = room.playerOrder.indexOf(playerId);
            let found = false;
            for (let i = 1; i < room.playerOrder.length; i++) {
                const nextIdx = (originalIdx + i) % room.playerOrder.length;
                if (room.players[room.playerOrder[nextIdx]].state === 'PLAYING') {
                    room.activeRound.currentTurnId = room.playerOrder[nextIdx];
                    found = true;
                    break;
                }
            }
        }
        await storage_1.roomsStorage.set(roomId, room);
        await broadcastRoomUpdate(roomId);
    });
    socket.on('disconnect', async () => {
        const { roomId, playerId } = socket.data;
        if (roomId && playerId) {
            const room = await storage_1.roomsStorage.get(roomId);
            if (room && room.players[playerId]) {
                room.players[playerId].connected = false;
                await storage_1.roomsStorage.set(roomId, room);
                await broadcastRoomUpdate(roomId);
            }
        }
    });
}
