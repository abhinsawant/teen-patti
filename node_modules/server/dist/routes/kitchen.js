"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const storage_1 = require("../storage");
const router = express_1.default.Router();
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
router.post('/open-kitchen', async (req, res) => {
    try {
        const { hostName, hostId, config } = req.body;
        // Check if there is already an active room. We only allow one.
        const allRooms = await storage_1.roomsStorage.getAll();
        const activeRooms = allRooms.filter(r => r.status === 'ACTIVE');
        if (activeRooms.length > 0) {
            return res.status(403).json({ error: 'An active room already exists on this server.' });
        }
        const roomId = generateRoomCode();
        const newRoom = {
            id: roomId,
            hostId,
            config: config,
            players: {},
            playerOrder: [],
            dealerId: '',
            locked: false,
            paused: false,
            pendingRebuys: [],
            status: 'ACTIVE',
            lastActivityTime: Date.now()
        };
        await storage_1.roomsStorage.set(roomId, newRoom);
        res.json({ success: true, roomId });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/inspect-kitchen/:id', async (req, res) => {
    try {
        const roomId = req.params.id.toUpperCase();
        const room = await storage_1.roomsStorage.get(roomId);
        if (!room || room.status !== 'ACTIVE') {
            return res.status(404).json({ error: 'Room not found or ended' });
        }
        res.json({ success: true, locked: room.locked, hostId: room.hostId });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/receipts/:playerId', async (req, res) => {
    try {
        const playerId = req.params.playerId;
        const allReceipts = await storage_1.settlementsStorage.getAll();
        // Filter receipts where the player participated
        const playerReceipts = allReceipts.filter(receipt => !!receipt.players[playerId]);
        // Sort descending by date
        playerReceipts.sort((a, b) => b.date - a.date);
        res.json(playerReceipts);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
