import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import cors from 'cors';
import kitchenRoutes from './routes/kitchen';
import { registerSocketHandlers } from './socket';
import { roomsStorage } from './storage';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

app.use('/api/kitchen', kitchenRoutes);

registerSocketHandlers(io);

// Serve static React frontend in production
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);

  // Cleanup any stuck active rooms from previous server runs
  const rooms = await roomsStorage.getAll();
  for (const room of rooms) {
    if (room.status === 'ACTIVE') {
      room.status = 'ENDED';
      await roomsStorage.set(room.id, room);
    }
  }
});
