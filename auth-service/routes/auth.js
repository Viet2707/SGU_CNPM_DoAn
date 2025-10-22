const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

// Register
router.post('/register', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashed, role });
    await newUser.save();
    res.status(201).send({ message: 'User registered' });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {

  console.log(req.body);
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).send({ error: 'User not found' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).send({ error: 'Invalid password' });

    const token = generateToken(user);
    res.send({ token, role: user.role });
  } catch (err) {
    res.status(500).send({ error: 'Server error' });
  }
});

module.exports = router;
