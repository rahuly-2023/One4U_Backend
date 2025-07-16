const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  item: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'FoodItem', 
    required: true 
  },
  quantity: { type: Number, required: true, min: 1 }
});

const orderSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'delivered', 'cancelled'],
    default: 'pending'
  },
  totalAmount: { type: Number, required: true },
  specialInstructions: { type: String },
  tableNumber: {  // Add this new field
    type: Number,
    required: true,
    min: 1,
    max: 50  // Adjust max as needed
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);