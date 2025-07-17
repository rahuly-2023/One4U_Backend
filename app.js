// backend/app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const routes = require('./routes');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 5500;

mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("DB Connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT']
  }
});

let userSockets = {};
let adminSockets = [];

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('register-user', (userId) => {
    userSockets[userId] = socket.id;
    console.log(`✅ User ${userId} registered with socket ${socket.id}`);
  });

  socket.on('register-admin', () => {
    adminSockets.push(socket);
    console.log('✅ Admin connected:', socket.id);
  });

  socket.on('disconnect', () => {
    adminSockets = adminSockets.filter(s => s.id !== socket.id);
    for (const [userId, id] of Object.entries(userSockets)) {
      if (id === socket.id) {
        delete userSockets[userId];
        console.log(`❌ User ${userId} disconnected`);
        break;
      }
    }
    console.log('❌ Disconnected:', socket.id);
  });


  // Allow emitting order updates from anywhere
  socket.on('order-status-update', ({ userId, orderId, status }) => {
    const userSocketId = userSockets[userId];
    if (userSocketId) {
      io.to(userSocketId).emit('order-updated', { orderId, status });
    }
  });
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.io = io;
  req.userSockets = userSockets;
  req.adminSockets = adminSockets;
  next();
});

app.use('/api', routes);

server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});