// routes/drone.js
const express = require("express");
const router = express.Router();
const axios = require("axios");

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || "http://order-service:5003";
const RESTAURANT_SERVICE_URL =
  process.env.RESTAURANT_SERVICE_URL || "http://restaurant-service:5002";

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

    // Nếu order có droneId thì lấy drone object từ DB để trả chi tiết hơn
    let droneDetails = null;
    try {
      const Drone = require("../models/Drone");
      if (order.droneId) {
        const d = await Drone.findById(order.droneId);
        if (d) {
          droneDetails = {
            id: d._id,
            code: d.code,
            name: d.name,
            status: d.status,
            batteryPercent: d.batteryPercent,
            currentLocation: d.currentLocation,
          };
        }
      } else {
        // fallback: try to find by assignedOrderId
        const d = await require("../models/Drone").findOne({
          assignedOrderId: order._id,
        });
        if (d) {
          droneDetails = {
            id: d._id,
            code: d.code,
            name: d.name,
            status: d.status,
            batteryPercent: d.batteryPercent,
            currentLocation: d.currentLocation,
          };
        }
      }
    } catch (err) {
      console.error("Error fetching drone details:", err.message);
    }

    // Fetch restaurant name from restaurant-service if possible
    let restaurantName = null;
    try {
      const restRes = await axios.get(
        `${RESTAURANT_SERVICE_URL}/api/restaurants`
      );
      if (Array.isArray(restRes.data)) {
        const r = restRes.data.find(
          (x) => String(x._id) === String(order.restaurantId)
        );
        if (r) restaurantName = r.name;
      }
    } catch (e) {
      console.warn("Warning: failed to fetch restaurant name:", e.message);
    }

    res.json({
      orderId: order._id,
      orderStatus: order.status,
      deliveryMethod: order.deliveryMethod || "delivery",
      customerId: order.customerId,
      restaurantId: order.restaurantId,
      restaurantName,

      restaurant: order.restaurantLocation, // ⭐ thêm restaurant
      customer: order.deliveryLocation, // ⭐ giữ customer
      drone: {
        // Prefer the real drone status from drone details
        status: droneDetails?.status || statusMap[order.status] || "idle",
        currentLocation: {
          latitude:
            order.droneLocation?.latitude || order.restaurantLocation?.latitude,
          longitude:
            order.droneLocation?.longitude ||
            order.restaurantLocation?.longitude,
        },
        id: droneDetails?.id || order.droneId || null,
        name: droneDetails?.name || droneDetails?.code || null,
        details: droneDetails,
        // droneStatus is deprecated - status field already contains the desired value
      },

      lastUpdatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error fetching drone tracking:", err.message);
    res.status(500).json({ message: "Failed to fetch drone tracking" });
  }
});

module.exports = router;
