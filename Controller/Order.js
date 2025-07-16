const jwt = require('jsonwebtoken');
const Order = require('../Models/Order');


getOrders =  async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'chirag');
    const orders = await Order.find({ user: decoded.userId })
      .sort({ createdAt: -1 })
      .populate('items.item');

    console.log(orders)
    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports ={getOrders};