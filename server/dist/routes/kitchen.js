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
    // --- Global Session Gatekeeper ---
    const allRooms = await storage_1.roomsStorage.readAll();
    for (const r of Object.values(allRooms)) {
        const isEmpty = Object.keys(r.players).length > 0 && Object.values(r.players).every(p => !p.connected);
        const isPausedLong = r.paused && r.pauseStartTime && (Date.now() - r.pauseStartTime >= 5 * 60 * 1000);
        const isEnded = r.status === 'ENDED';
        const isStale = (Date.now() - r.lastActivityTime) >= 5 * 60 * 1000;
        if (isEmpty || isPausedLong || isEnded || isStale) {
            // Clean up inactive room
            await storage_1.roomsStorage.delete(r.id);
        }
        else {
            // Room is active
            return res.status(403).json({ error: 'Another game is currently active. Please wait or join the existing room.' });
        }
    }
    // ---------------------------------
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
        lastActivityTime: Date.now(),
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
