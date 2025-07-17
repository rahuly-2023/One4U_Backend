// backend/Controller/UpdateStatus.js

const Order = require('../Models/Order');
const FoodItem = require('../Models/FoodItem')
const User=require('../Models/User')
const SpecialRequest = require('../Models/SpecialRequest');

UpdateStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'preparing', 'served', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('user');

    const userId = order.user._id.toString();
    const userSocketId = req.userSockets[userId];

    if (userSocketId) {
      req.io.to(userSocketId).emit('order-updated', {
        orderId: order._id,
        status: order.status
      });
    }

    req.adminSockets.forEach(socket => {
      socket.emit('order-updated', { 
        orderId: order._id,
        status: order.status 
      });
    });

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update status' });
  }
}

module.exports = {UpdateStatus};



