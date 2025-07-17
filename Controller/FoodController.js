// backend/Controller/FoodController.js


const FoodCategory = require('../Models/FoodCategory');
const FoodItem = require('../Models/FoodItem');
const Order = require('../Models/Order');
const User = require('../Models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

// Get all food categories with their items
const getMenu = async (req, res) => {
  try {
    const categories = await FoodCategory.find().populate({
      path: 'items',
      model: 'FoodItem',
      match: { isAvailable: true }
    });
    
    // console.log(categories);
    res.status(200).json(categories);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};










// Helper: Generate Gemini prompt
function generateGeminiPrompt(userName, recentOrders) {
  const lines = [`Analyze the following food order history of ${userName} and provide a single-sentence tip or insight about their food preferences:`];

  recentOrders.forEach((order, idx) => {
    const itemList = order.items.map(i => `${i.quantity}x ${i.item.name}`).join(', ');
    lines.push(`Order ${idx + 1}: ${itemList}`);
  });

  return lines.join('\n');
}

// Helper: Call Gemini API
// async function getGeminiFoodTip(promptText) {
//   try {
//     console.log("gemini key ", process.env.GEMINI_API_KEY);
//     const response = await axios.post(
//       'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + process.env.GEMINI_API_KEY,
//       {
//         contents: [
//           {
//             role: "user",
//             parts: [{ text: promptText }]
//           }
//         ]
//       },
//       {
//         headers: { 'Content-Type': 'application/json' }
//       }
//     );


//     const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
//     return reply.trim();
//   } catch (err) {
//     console.error('Gemini API call failed:', err.message);
//     return '';
//   }
// }



async function getGeminiFoodTip(promptText) {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: promptText }
            ]
          }
        ]
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim() || '';
  } catch (err) {
    console.error('Gemini API call failed:', err.response?.data || err.message);
    return '';
  }
}












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








    // Get user with recent orders and populate item names
    const user = await User.findById(tokenPayload.userId).populate({
      path: 'recentOrders',
      populate: {
        path: 'items.item',
        model: 'FoodItem',
        select: 'name'
      }
    });

    let geminiTip = '';
    if (user && user.recentOrders?.length > 0) {
      const prompt = generateGeminiPrompt(user.name, user.recentOrders);
      geminiTip = await getGeminiFoodTip(prompt);
      console.log("Promt ", prompt);
      console.log("Tip ", geminiTip);
    }

    // const combinedInstructions = [specialInstructions, geminiTip].filter(Boolean).join('\n');
    const combinedInstructions = JSON.stringify({
      user: specialInstructions || '',
      gemini: geminiTip || ''
    });

    console.log("Combined ", combinedInstructions);













    // Create the order
    const order = new Order({
      user: tokenPayload.userId,
      items: itemDetails,
      totalAmount,
      specialInstructions: combinedInstructions,
      tableNumber,
      status: 'pending'
    });

    await order.save();

    const populatedOrder = await Order.findById(order._id)
    .populate('user', 'name email')
    .populate('items.item', 'name price');

    req.adminSockets.forEach(socket => {
      socket.emit('new-order', populatedOrder);
    });
    
    // req.io.emit('new-order', populatedOrder);

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