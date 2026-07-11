"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const socket_1 = require("./socket");
const kitchen_1 = __importDefault(require("./routes/kitchen"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API Routes
app.use('/api/kitchen', kitchen_1.default);
// Static file serving for the client
const clientDistPath = path_1.default.join(__dirname, '../../../client/dist');
app.use(express_1.default.static(clientDistPath));
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(clientDistPath, 'index.html'));
});
// Setup Socket
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    (0, socket_1.registerSocketHandlers)(io, socket);
});
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
