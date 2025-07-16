const mongoose = require('mongoose');

const foodCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  imageUrl: { type: String },
  items: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'FoodItem' 
  }]
}, { timestamps: true });

module.exports = mongoose.model('FoodCategory', foodCategorySchema);