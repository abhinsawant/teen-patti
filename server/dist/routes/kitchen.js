"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storage_1 = require("../storage");
const router = (0, express_1.Router)();
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}
// "open-kitchen": Create a new room (restaurant)
router.post('/open-kitchen', async (req, res) => {
    const { hostName, hostId, config } = req.body;
    const roomId = generateRoomCode();
    const newRoom = {
        id: roomId,
        hostId,
        config: {
            buyIn: config?.buyIn || 1000,
            rebuyAmount: config?.rebuyAmount || 1000,
            maxRebuys: config?.maxRebuys || 3,
            autoApprove: config?.autoApprove ?? true,
            startingBlind: config?.startingBlind || 5
        },
        players: {},
        playerOrder: [],
        dealerId: '',
        locked: false,
        paused: false,
        pendingRebuys: [],
        status: 'ACTIVE',
    };
    await storage_1.roomsStorage.set(roomId, newRoom);
    res.json({ success: true, roomId, room: newRoom });
});
// "inspect-kitchen": Check if a room exists
router.get('/inspect-kitchen/:id', async (req, res) => {
    const room = await storage_1.roomsStorage.get(req.params.id.toUpperCase());
    if (!room) {
        return res.status(404).json({ error: 'Kitchen closed or not found' });
    }
    // Filter out sensitive info before sending via REST
    res.json({ success: true, locked: room.locked, hostId: room.hostId });
});
// "receipts": Get past settlements for a user
router.get('/receipts/:playerId', async (req, res) => {
    const { playerId } = req.params;
    const allReceipts = await storage_1.settlementsStorage.readAll();
    const userReceipts = Object.values(allReceipts)
        .filter(receipt => !!receipt.players[playerId])
        .sort((a, b) => b.date - a.date); // newest first
    res.json({ success: true, receipts: userReceipts });
});
exports.default = router;
