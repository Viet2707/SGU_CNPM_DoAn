// routes/drone.js
const express = require("express");
const router = express.Router();
const axios = require("axios");

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || "http://order-service:5003";

// 🛰 API FE gọi để lấy thông tin tracking drone
router.get("/tracking/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const orderRes = await axios.get(`${ORDER_SERVICE_URL}/orders/${orderId}`, {
      headers: { Authorization: req.headers.authorization || "" },
    });
    const order = orderRes.data;

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const statusMap = {
      pending: "idle",
      accepted: "preparing",
      "in-transit": "in_transit",
      delivered: "delivered",
    };

    const deliveryLocation = order.deliveryLocation || {};
    const lat = deliveryLocation.latitude;
    const lng = deliveryLocation.longitude;

    res.json({
      orderId: order._id,
      orderStatus: order.status,
      deliveryMethod: order.deliveryMethod || "delivery",

      restaurant: order.restaurantLocation, // ⭐ thêm restaurant
      customer: order.deliveryLocation, // ⭐ giữ customer
      drone: {
        status: statusMap[order.status] || "idle",
        currentLocation: {
          latitude:
            order.droneLocation?.latitude || order.restaurantLocation?.latitude,
          longitude:
            order.droneLocation?.longitude ||
            order.restaurantLocation?.longitude,
        },
      },

      lastUpdatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error fetching drone tracking:", err.message);
    res.status(500).json({ message: "Failed to fetch drone tracking" });
  }
});

module.exports = router;
