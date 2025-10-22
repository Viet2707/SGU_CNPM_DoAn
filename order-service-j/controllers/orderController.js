const Order = require('../models/order');

// Create an order
const createOrder = async (req, res) => {
  try {
    const { customerId, restaurantId, items, total } = req.body;

    // Validate required fields
    if (!customerId || !restaurantId || !items || total == null) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const order = new Order({ customerId, restaurantId, items, total });
    await order.save();

    // Optionally, notify Restaurant Service
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: `Failed to create order: ${error.message}` });
  }
};

// Update an order (before confirmation)
const updateOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { items, total } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot modify confirmed order' });
    }

    // Update only provided fields
    if (items) order.items = items;
    if (total != null) order.total = total;

    await order.save();
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: `Failed to update order: ${error.message}` });
  }
};

// Track order status
const getOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: `Failed to fetch order: ${error.message}` });
  }
};

module.exports = {
  createOrder,
  updateOrder,
  getOrder,
};