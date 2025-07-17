// backend/Models/SpecialRequest.js


const mongoose = require('mongoose');

const specialRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestType: { type: String, required: true },
  data: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('SpecialRequest', specialRequestSchema);
