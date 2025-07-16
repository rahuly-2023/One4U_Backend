const express = require('express');
const router = express.Router();
const  {signup}=require('./Controller/Signup')
const {login}=require('./Controller/Login')
const {SRequest}=require('./Controller/SRequest')
const { getMenu, placeOrder, getRecommendations } = require('./Controller/FoodController');
const {getOrders}=require('./Controller/Order');
const jwt = require('jsonwebtoken');

// Sample route
router.get('', (req, res) => {
  res.send('API is working!');
});
router.post('/signup',signup)
router.post('/login',login)
router.post('/specialrequest',SRequest)

// Food routes
router.get('/menu', getMenu);
router.post('/order', placeOrder);
router.post('/recommendations', getRecommendations);


router.get('/orders', getOrders);









module.exports = router;
