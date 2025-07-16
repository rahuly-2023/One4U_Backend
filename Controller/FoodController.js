const FoodCategory = require('../Models/FoodCategory');
const FoodItem = require('../Models/FoodItem');
const Order = require('../Models/Order');
const User = require('../Models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Get all food categories with their items
const getMenu = async (req, res) => {
  try {
    const categories = await FoodCategory.find().populate({
      path: 'items',
      model: 'FoodItem',
      match: { isAvailable: true }
    });
    
    console.log(categories);
    res.status(200).json(categories);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Place a new order
const placeOrder = async (req, res) => {
  try {
    const { items, specialInstructions, tableNumber, Token } = req.body;
    
    if (!Token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    const tokenPayload = jwt.decode(Token);
    if (!tokenPayload || !tokenPayload.userId) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!tableNumber) {
      return res.status(400).json({ message: 'Table number is required' });
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    // Calculate total amount and validate items
    let totalAmount = 0;
    const itemDetails = await Promise.all(
      items.map(async (item) => {
        const foodItem = await FoodItem.findById(item.itemId);
        if (!foodItem || !foodItem.isAvailable) {
          throw new Error(`Item ${item.itemId} not available`);
        }
        totalAmount += foodItem.price * item.quantity;
        return {
          item: foodItem._id,
          quantity: item.quantity
        };
      })
    );

    // Create the order
    const order = new Order({
      user: tokenPayload.userId,
      items: itemDetails,
      totalAmount,
      specialInstructions,
      tableNumber,
      status: 'pending'
    });

    await order.save();

    const populatedOrder = await Order.findById(order._id)
    .populate('user', 'name email')
    .populate('items.item', 'name price');
    
    req.io.emit('new-order', populatedOrder);

    // Update user's order history for recommendations
    await User.findByIdAndUpdate(tokenPayload.userId, {
      $push: { 
        recentOrders: { 
          $each: [order._id], 
          $slice: -10 // Keep only last 10 orders
        } 
      }
    });

    
    // req.io.emit('new-order', order); // or use adminSockets.forEach(s => s.emit(...)) for targeting
      

    res.status(201).json({ 
      message: 'Order placed successfully',
      orderId: order._id
    });

  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ 
      message: error.message || 'Internal server error' 
    });
  }
};


// Get recommended items based on user's item-level frequency
const getRecommendations = async (req, res) => {
  try {
    const { Token } = req.body;

    if (!Token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    const tokenPayload = jwt.decode(Token);
    if (!tokenPayload || !tokenPayload.userId) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Get user with recent orders and food items populated
    const user = await User.findById(tokenPayload.userId)
      .populate({
        path: 'recentOrders',
        populate: {
          path: 'items.item',
          model: 'FoodItem',
          select: 'name category isAvailable imageUrl price'
        }
      });


    if (!user || !user.recentOrders || user.recentOrders.length === 0) {
      const fallback = await FoodItem.find({ isAvailable: true })
        .sort({ createdAt: -1 })
        .limit(6);
      return res.status(200).json(fallback);
    }

    // Count frequency of items across recent orders
    const itemFrequency = {};
    user.recentOrders.forEach(order => {
      order.items.forEach(({ item, quantity }) => {
        if (item && item.isAvailable) {
          const id = item._id.toString();
          itemFrequency[id] = (itemFrequency[id] || 0) + quantity;
        }
      });
    });


    const sortedItemIds = Object.entries(itemFrequency)
      .sort((a, b) => b[1] - a[1]) // sort by frequency
      .map(([itemId]) => itemId);

    if (sortedItemIds.length === 0) {
      const fallback = await FoodItem.find({ isAvailable: true }).limit(6);
      return res.status(200).json(fallback);
    }

    // Fetch top recommended items based on frequency
    const items = await FoodItem.find({
      _id: { $in: sortedItemIds },
      isAvailable: true
    });

    const itemMap = {};
    items.forEach(item => {
      itemMap[item._id.toString()] = item;
    });

    const recommendedItems = sortedItemIds
      .map(id => itemMap[id])
      .filter(Boolean)
      .slice(0, 6);


    res.status(200).json(recommendedItems);

  } catch (error) {
    console.error('Error generating recommendations:', error);
    try {
      const fallback = await FoodItem.find({ isAvailable: true }).limit(6);
      res.status(200).json(fallback);
    } catch (fallbackError) {
      res.status(500).json({ message: 'Recommendation failed', error: fallbackError.message });
    }
  }
};


module.exports = {
  getMenu,
  placeOrder,
  getRecommendations
};