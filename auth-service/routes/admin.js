const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyToken, allowRoles } = require('../utils/jwt');

// Get all users (admin only)
router.get('/users', verifyToken, allowRoles('admin'), async (req, res) => {
  const users = await User.find({}, '-password'); // exclude passwords
  res.send(users);
});

// Get all restaurants (admin only)
router.get('/restaurants', verifyToken, allowRoles('admin'), async (req, res) => {
  const restaurants = await User.find({ role: 'restaurant' }, '-password');
  res.send(restaurants);
});

// Approve a restaurant (mock example – add status flag)
router.patch('/verify-restaurant/:id', verifyToken, allowRoles('admin'), async (req, res) => {
  const { id } = req.params;
  await User.findByIdAndUpdate(id, { verified: true });
  res.send({ message: 'Restaurant verified' });
});

module.exports = router;
