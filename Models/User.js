// backend/Models/User.js


const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  recentOrders: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order' 
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
