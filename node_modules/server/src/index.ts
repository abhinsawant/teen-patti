import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { registerSocketHandlers } from './socket';
import kitchenRoutes from './routes/kitchen';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/kitchen', kitchenRoutes);

// Static file serving for the client
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Setup Socket
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  registerSocketHandlers(io, socket);
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
