const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const restaurantRoutes = require('./routes/restaurant');

dotenv.config();
const app = express();

app.use(express.json());

// Connect to MongoDB
  mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000, // 30 seconds
    socketTimeoutMS: 45000, // 45 seconds
  })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));


// Routes
app.use('/api/restaurants', restaurantRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Restaurant Service running on port ${PORT}`));