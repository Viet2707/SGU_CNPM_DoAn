const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { verifyToken, allowRoles } = require('../utils/authMiddleware');
const axios = require('axios');

const NOTIFY_SERVICE_URL = process.env.NOTIFY_SERVICE_URL;

/* ===========================
   🧍 CUSTOMER ROUTES
=========================== */

// 🏢 Fetch all restaurants
router.get('/restaurants', verifyToken, allowRoles('customer'), async (req, res) => {
  try {
    const response = await axios.get('http://restaurant-service:5002/restaurant/api/restaurants');
    res.json(response.data);
  } catch (err) {
    console.error('Failed to fetch restaurants:', err.message);
    res.status(500).json({ message: 'Failed to fetch restaurants' });
  }
});

// 🍽️ Fetch menu by restaurantId
router.get('/restaurant/:restaurantId/menu', verifyToken, allowRoles('customer'), async (req, res) => {
  const { restaurantId } = req.params;
  try {
    const response = await axios.get(`http://restaurant-service:5002/restaurant/${restaurantId}/menu`);
    res.json(response.data);
  } catch (err) {
    console.error('Failed to fetch menu:', err.message);
    res.status(500).json({ message: 'Failed to fetch menu items' });
  }
});

// 🧾 Customer places an order
router.post('/create', verifyToken, allowRoles('customer'), async (req, res) => {
  const { restaurantId, items, deliveryLocation, paymentIntentId } = req.body;

  if (!restaurantId || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ message: 'Restaurant ID and items are required' });

  if (
    !deliveryLocation ||
    typeof deliveryLocation.latitude !== 'number' ||
    typeof deliveryLocation.longitude !== 'number'
  )
    return res.status(400).json({ message: 'Valid delivery location required' });

  if (!paymentIntentId)
    return res.status(400).json({ message: 'Payment Intent ID is required' });

  try {
    // ✅ Verify payment
    const paymentResponse = await axios.get(
      `http://payment-service:5008/payment/verify-payment/${paymentIntentId}`,
      { headers: { Authorization: req.headers.authorization } }
    );

    if (paymentResponse.data.status !== 'succeeded')
      return res.status(400).json({ message: 'Payment not successful' });

    // ✅ Save order
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const order = new Order({
      customerId: req.user.id,
      restaurantId,
      items,
      total,
      deliveryLocation,
      paymentIntentId,
    });
    await order.save();

    // ✅ Update payment service
    await axios.post(
      `http://payment-service:5008/payment/update/${paymentIntentId}`,
      { orderId: order._id },
      { headers: { Authorization: req.headers.authorization } }
    );

    res.status(201).json({ message: 'Order created successfully', order });
  } catch (err) {
    console.error('Order creation error:', err.message);
    res.status(500).json({ message: 'Failed to create order' });
  }
});

// 📦 Customer views their orders
router.get('/customer/orders', verifyToken, allowRoles('customer'), async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.user.id });
    res.json(orders);
  } catch {
    res.status(500).json({ message: 'Failed to fetch customer orders' });
  }
});

/* ===========================
   🍴 RESTAURANT ROUTES
=========================== */

// 🍽️ Restaurant fetches incoming orders
router.get('/restaurant', verifyToken, allowRoles('restaurant'), async (req, res) => {
  try {
    const restaurantRes = await axios.get(
      'http://restaurant-service:5002/restaurant/api/restaurants-id',
      { headers: { Authorization: req.headers.authorization } }
    );

    const restaurantIds = restaurantRes.data.map(r => r._id);
    const orders = await Order.find({ restaurantId: { $in: restaurantIds } });
    res.json(orders);
  } catch (err) {
    console.error('Error fetching restaurant orders:', err.message);
    res.status(500).json({ message: 'Failed to fetch restaurant orders' });
  }
});

// ✅ Restaurant or delivery updates order status
router.patch('/status/:id', verifyToken, allowRoles('restaurant', 'delivery'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatus = ['accepted', 'in-transit', 'delivered'];

  if (!validStatus.includes(status))
    return res.status(400).json({ message: 'Invalid status' });

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  order.status = status;
  if (req.user.role === 'delivery' && status === 'in-transit')
    order.deliveryPersonId = req.user.id;

  await order.save();

  // 🔔 Notify customer
  const fakeCustomerPhone = '+94761111222';
  const fakeCustomerEmail = 'jayaisurusamarakoon2@gmail.com';
  try {
    if (status === 'accepted') {
      await axios.post(`${NOTIFY_SERVICE_URL}/notify/email`, {
        to: fakeCustomerEmail,
        subject: 'Your order has been accepted!',
        text: 'Your order is now being prepared and will be delivered soon.',
      });
    } else if (status === 'in-transit') {
      await axios.post(`${NOTIFY_SERVICE_URL}/notify/sms`, {
        to: fakeCustomerPhone,
        message: `🚴 Your delivery is on the way!`,
      });
    } else if (status === 'delivered') {
      await axios.post(`${NOTIFY_SERVICE_URL}/notify/email`, {
        to: fakeCustomerEmail,
        subject: 'Order Delivered!',
        text: 'Your order has been delivered. Enjoy your meal!',
      });
      await axios.post(`${NOTIFY_SERVICE_URL}/notify/sms`, {
        to: fakeCustomerPhone,
        message: `📦 Your order has been delivered.`,
      });
    }
  } catch (err) {
    console.error('Failed to notify user:', err.message);
  }

  res.json({ message: 'Order status updated successfully' });
});

/* ===========================
   🚚 DELIVERY ROUTES
=========================== */

// 🧾 All available or assigned orders
router.get('/delivery/orders', verifyToken, allowRoles('delivery'), async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [
        { status: 'in-transit', deliveryPersonId: req.user.id },
        { status: 'accepted' },
      ],
    });
    res.json(orders);
  } catch {
    res.status(500).json({ message: 'Failed to fetch delivery orders' });
  }
});

// 🧾 All not delivered yet
router.get('/delivery/all', verifyToken, allowRoles('delivery'), async (req, res) => {
  const orders = await Order.find({ status: { $ne: 'delivered' } });
  res.json(orders);
});

/* ===========================
   🧑‍💼 ADMIN ROUTES
=========================== */

// 📊 Admin: overall stats
router.get('/admin/stats', verifyToken, allowRoles('admin'), async (req, res) => {
  try {
    // Check connection state
    if (!Order.db || Order.db.readyState !== 1) {
      return res.status(500).json({ message: "Database not connected" });
    }

    const totalOrders = await Order.countDocuments();
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    const pendingOrders = await Order.countDocuments({ status: 'pending' });

    // Aggregate total revenue
    const revenueResult = await Order.aggregate([
      { $match: { status: 'delivered' } },
      { $group: { _id: null, totalRevenue: { $sum: { $ifNull: ["$total", 0] } } } }
    ]).catch(err => {
      console.error("Revenue aggregation failed:", err.message);
      return [];
    });

    const totalRevenue = revenueResult?.[0]?.totalRevenue || 0;

    res.json({
      orders: totalOrders || 0,
      delivered: deliveredOrders || 0,
      pending: pendingOrders || 0,
      revenue: totalRevenue,
    });
  } catch (err) {
    console.error("Admin stats error:", err.message);
    res.status(500).json({ message: "Failed to fetch admin stats", error: err.message });
  }
});

module.exports = router;
