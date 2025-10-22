const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');

// Create a restaurant
router.post('/', restaurantController.createRestaurant);

// Get all restaurants
router.get('/', restaurantController.getAllRestaurants);

// Add a menu item
router.post('/:restaurantId/menu', restaurantController.addMenuItem);

// Update a menu item
router.put('/:restaurantId/menu/:itemId', restaurantController.updateMenuItem);

// Delete a menu item
router.delete('/:restaurantId/menu/:itemId', restaurantController.deleteMenuItem);

// Set restaurant availability
router.patch('/:restaurantId/availability', restaurantController.setAvailability);

// Get restaurant orders
router.get('/:restaurantId/orders', restaurantController.getRestaurantOrders);

module.exports = router;