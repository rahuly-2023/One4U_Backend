const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const routes=require('./routes')
require('dotenv').config();
const http = require('http');

const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 5500;

// MongoDB connection
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true, 
})
.then(() => console.log("DB Connected"))
.catch((err) => console.error("MongoDB connection error:", err));




const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // or use exact origins like ['http://localhost:4000']
    methods: ['GET', 'POST']
  }
});
let adminSockets = [];
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('register-admin', () => {
    adminSockets.push(socket);
    console.log('✅ Admin connected:', socket.id);
  });

  socket.on('disconnect', () => {
    adminSockets = adminSockets.filter(s => s.id !== socket.id);
    console.log('❌ Disconnected:', socket.id);
  });
});



// Middleware
app.use(cors()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.io = io;
  next();
});



app.use('/api',routes)

// Start server
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
