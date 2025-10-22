const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const multer = require('multer');
const path = require('path');
const { verifyToken, allowRoles } = require('../utils/authMiddleware');
const { v2: cloudinary } = require('cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
///restaurant/api/restaurants
router.get('/api/restaurants', async (req, res) => {
 
  try {
    const restaurants = await Restaurant.find(); // You can add filters if needed
    res.json(restaurants);
  } catch (err) {
    console.error('Error fetching restaurants:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/api/restaurants-id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id; 
    console.log('Logged-in user ID:', userId);

    const restaurants = await Restaurant.find({ ownerId: userId });
    res.json(restaurants);
  } catch (err) {
    console.error('Error fetching restaurant IDs:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:restaurantId/menu', async (req, res) => {
  const { restaurantId } = req.params;
  console.log('Fetching menu for restaurant:', restaurantId);

  try {
    // Fetch restaurant by hardcoded ID (or dynamically use the passed restaurantId)
    const restaurant = await Restaurant.findById(restaurantId);
    console.log('Restaurant found:', restaurant);

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // Fetch menu items for the specific restaurant
    const menuItems = await MenuItem.find({ restaurantId: restaurant._id });
    console.log('Menu Items:', menuItems);

    if (menuItems.length === 0) {
      return res.status(404).json({ message: 'No menu items found for this restaurant' });
    }

    res.json(menuItems);  // Return the menu items
  } catch (err) {
    console.error('Error fetching menu:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});



// Create restaurant profile
router.post('/profile', verifyToken, allowRoles('restaurant'), async (req, res) => {
  try {
    const { name } = req.body;
    const restaurant = new Restaurant({ name, ownerId: req.user.id, isOpen: true });
    await restaurant.save();
    res.send({ message: 'Restaurant profile created', restaurant });
  } catch (err) {
    console.error('Error in /restaurant/profile:', err);
    res.status(500).send({ message: 'Internal server error' });
  }
});

// Add menu item
// router.post('/menu', verifyToken, allowRoles('restaurant'), async (req, res) => {
//   try {

//     const userId = req.user.id; 
//     console.log('Logged-in user ID:', userId);

//     const restaurant = await Restaurant.findOne({ ownerId: userId });
//     if (!restaurant) {
//       return res.status(404).json({ message: 'Restaurant not found' });
//     }

//     const { name, description, price } = req.body;
//     const item = new MenuItem({ name, description, price, restaurantId: restaurant._id });
//     await item.save();
//     res.send({ message: 'Menu item added', item });
//   } catch (err) {
//     console.error('Error in /restaurant/menu:', err);
//     res.status(500).send({ message: 'Internal server error' });
//   }
// });

// Add menu item with image
router.post('/menu', verifyToken, allowRoles('restaurant'), async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Logged-in user ID:', userId);

    const restaurant = await Restaurant.findOne({ ownerId: userId });
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    const { name, description, price } = req.body;
    let imageUrl;

    // Handle image upload to Cloudinary
    if (req.files && req.files.image) {
      const file = req.files.image;
      // Validate file type
      const filetypes = /jpeg|jpg|png/;
      const mimetype = filetypes.test(file.mimetype);
      if (!mimetype) {
        return res.status(400).json({ message: 'Only JPEG/JPG/PNG images are allowed' });
      }

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: 'food-delivery/menu',
        resource_type: 'image'
      });
      imageUrl = result.secure_url;
      console.log('Cloudinary upload result:', result.secure_url);
    }

    const item = new MenuItem({
      name,
      description,
      price: parseFloat(price),
      restaurantId: restaurant._id,
      imageUrl
    });
    await item.save();

    res.send({ message: 'Menu item added', item });
  } catch (err) {
    console.error('Error in /restaurant/menu:', err);
    res.status(500).send({ message: err.message || 'Internal server error' });
  }
});

// View own menu items
router.get('/menu', verifyToken, allowRoles('restaurant'), async (req, res) => {
  try {
    const userId = req.user.id; 
    console.log('Logged-in user ID:', userId);

    const restaurants = await Restaurant.find({ ownerId: userId });
    const restaurantIds = restaurants.map(restaurant => restaurant._id);

    const items = await MenuItem.find({ restaurantId: { $in: restaurantIds } });
    res.send(items);
  } catch (err) {
    console.error('Error in /restaurant/menu GET:', err);
    res.status(500).send({ message: 'Internal server error' });
  }
});

// Delete a menu item
router.delete('/menu/:id', verifyToken, allowRoles('restaurant'), async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.id);
    res.send({ message: 'Menu item deleted' });
  } catch (err) {
    console.error('Error in /restaurant/menu/:id DELETE:', err);
    res.status(500).send({ message: 'Internal server error' });
  }
});

// Get all menu items with restaurant names
router.get('/menu/all', verifyToken, async (req, res) => {
  try {
    // Fetch all menu items
    const menuItems = await MenuItem.find();
    
    // Fetch restaurant names
    const restaurantIds = [...new Set(menuItems.map(item => item.restaurantId.trim()))]; // 🛠️ trim added here
    const restaurants = await Restaurant.find({ _id: { $in: restaurantIds } });
    const restaurantMap = restaurants.reduce((map, restaurant) => {
      map[restaurant._id] = restaurant.name;
      return map;
    }, {});

    // Combine menu items with restaurant names
    const itemsWithRestaurant = menuItems.map(item => ({
      _id: item._id,
      name: item.name,
      description: item.description,
      price: item.price,
      imageUrl: item.imageUrl,
      restaurantId: item.restaurantId.trim(), // 🛠️ trim here too
      restaurantName: restaurantMap[item.restaurantId.trim()] || 'Unknown Restaurant'
    }));

    res.json(itemsWithRestaurant);
  } catch (err) {
    console.error('Error fetching menu items:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});



module.exports = router;
