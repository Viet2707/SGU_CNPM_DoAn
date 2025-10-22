const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Create an order
router.post('/', orderController.createOrder);

// Update an order (before confirmation)
router.put('/:orderId', orderController.updateOrder);

// Track order status
router.get('/:orderId', orderController.getOrder);

module.exports = router;