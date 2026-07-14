"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const kitchen_1 = __importDefault(require("./routes/kitchen"));
const socket_1 = require("./socket");
const storage_1 = require("./storage");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api/kitchen', kitchen_1.default);
(0, socket_1.registerSocketHandlers)(io);
// Serve static React frontend in production
const clientDistPath = path_1.default.join(__dirname, '../../client/dist');
app.use(express_1.default.static(clientDistPath));
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(clientDistPath, 'index.html'));
});
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT}`);
    // Cleanup any stuck active rooms from previous server runs
    const rooms = await storage_1.roomsStorage.getAll();
    for (const room of rooms) {
        if (room.status === 'ACTIVE') {
            room.status = 'ENDED';
            await storage_1.roomsStorage.set(room.id, room);
        }
    }
});
