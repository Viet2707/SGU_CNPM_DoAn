const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { verifyToken, allowRoles } = require("../utils/authMiddleware");
const axios = require("axios");
const { publishEvent } = require("../rabbitmq"); // 🔔 RabbitMQ

const NOTIFY_SERVICE_URL = process.env.NOTIFY_SERVICE_URL;

/* ===========================
   🧍 CUSTOMER ROUTES
=========================== */

// 🏢 Fetch all restaurants
router.get(
  "/restaurants",
  verifyToken,
  allowRoles("customer"),
  async (req, res) => {
    try {
      const response = await axios.get(
        "http://restaurant-service:5002/restaurant/api/restaurants"
      );
      res.json(response.data);
    } catch (err) {
      console.error("Failed to fetch restaurants:", err.message);
      res.status(500).json({ message: "Failed to fetch restaurants" });
    }
  }
);

// 🍽️ Fetch menu by restaurantId
router.get(
  "/restaurant/:restaurantId/menu",
  verifyToken,
  allowRoles("customer"),
  async (req, res) => {
    const { restaurantId } = req.params;
    try {
      const response = await axios.get(
        `http://restaurant-service:5002/restaurant/${restaurantId}/menu`
      );
      res.json(response.data);
    } catch (err) {
      console.error("Failed to fetch menu:", err.message);
      res.status(500).json({ message: "Failed to fetch menu items" });
    }
  }
);

// 🧾 Customer places an order
router.post(
  "/create",
  verifyToken,
  allowRoles("customer"),
  async (req, res) => {
    const { restaurantId, items, deliveryLocation, paymentIntentId } = req.body;

    if (!restaurantId || !Array.isArray(items) || items.length === 0)
      return res
        .status(400)
        .json({ message: "Restaurant ID and items are required" });

    if (
      !deliveryLocation ||
      typeof deliveryLocation.latitude !== "number" ||
      typeof deliveryLocation.longitude !== "number"
    )
      return res
        .status(400)
        .json({ message: "Valid delivery location required" });

    if (!paymentIntentId)
      return res.status(400).json({ message: "Payment Intent ID is required" });

    try {
      // ✅ Verify payment
      const paymentResponse = await axios.get(
        `http://payment-service:5008/verify-payment/${paymentIntentId}`,
        { headers: { Authorization: req.headers.authorization } }
      );

      if (paymentResponse.data.status !== "succeeded")
        return res.status(400).json({ message: "Payment not successful" });

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
        `http://payment-service:5008/update/${paymentIntentId}`,
        { orderId: order._id },
        { headers: { Authorization: req.headers.authorization } }
      );

      // 🔔 Publish event: order.created
      await publishEvent("order.created", {
        orderId: order._id.toString(),
        customerId: order.customerId,
        restaurantId: order.restaurantId,
        items: order.items,
        total: order.total,
        status: order.status,
      });

      res.status(201).json({ message: "Order created successfully", order });
    } catch (err) {
      console.error("Order creation error:", err.message);
      res.status(500).json({ message: "Failed to create order" });
    }
  }
);

// 📦 Customer views their orders
router.get(
  "/customer/orders",
  verifyToken,
  allowRoles("customer"),
  async (req, res) => {
    try {
      const orders = await Order.find({ customerId: req.user.id });
      res.json(orders);
    } catch {
      res.status(500).json({ message: "Failed to fetch customer orders" });
    }
  }
);

/* ===========================
   🍴 RESTAURANT ROUTES
=========================== */

// 🍽️ Restaurant fetches incoming orders
router.get(
  "/restaurant",
  verifyToken,
  allowRoles("restaurant"),
  async (req, res) => {
    try {
      const restaurantRes = await axios.get(
        "http://restaurant-service:5002/api/restaurants-id",
        { headers: { Authorization: req.headers.authorization } }
      );

      // ✅ Chuyển ObjectId -> string trước khi tìm
      const restaurantIds = restaurantRes.data.map((r) =>
        typeof r._id === "object" && r._id !== null && r._id.toString
          ? r._id.toString()
          : String(r._id)
      );

      console.log("Restaurant IDs for owner:", restaurantIds);

      const orders = await Order.find({
        restaurantId: { $in: restaurantIds },
      });

      res.json(orders);
    } catch (err) {
      console.error("Error fetching restaurant orders:", err.message);
      res.status(500).json({ message: "Failed to fetch restaurant orders" });
    }
  }
);

// ✅ Restaurant or delivery updates order status
router.patch(
  "/status/:id",
  verifyToken,
  allowRoles("restaurant", "delivery"),
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const validStatus = ["accepted", "in-transit", "delivered"];

    if (!validStatus.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = status;
    if (req.user.role === "delivery" && status === "in-transit") {
      order.deliveryPersonId = req.user.id;
    }

    await order.save();

    // 🔔 RabbitMQ event theo vai trò + status
    try {
      if (req.user.role === "restaurant" && status === "accepted") {
        // Nhà hàng accept đơn
        await publishEvent("order.accepted", {
          orderId: order._id.toString(),
          restaurantId: order.restaurantId,
          customerId: order.customerId,
        });
      }

      if (req.user.role === "delivery") {
        if (status === "in-transit") {
          // Shipper nhận đơn + bắt đầu giao
          await publishEvent("order.assigned", {
            orderId: order._id.toString(),
            deliveryPersonId: req.user.id,
            restaurantId: order.restaurantId,
            customerId: order.customerId,
          });

          await publishEvent("delivery.in_transit", {
            orderId: order._id.toString(),
            deliveryPersonId: req.user.id,
            status: "in_transit",
          });
        } else if (status === "delivered") {
          // Shipper giao xong
          await publishEvent("delivery.completed", {
            orderId: order._id.toString(),
            deliveryPersonId: req.user.id,
            status: "completed",
          });
        }
      }
    } catch (e) {
      console.error("[RabbitMQ] Failed to publish status event:", e.message);
      // Không chặn response cho client, chỉ log lỗi event
    }

    res.json({ message: "Order status updated successfully", order });
  }
);

/* ===========================
   🚚 DELIVERY ROUTES
=========================== */

// 🧾 All available or assigned orders
// ✅ Delivery xem được các đơn hàng cần giao
router.get(
  "/order/delivery/orders",
  verifyToken,
  allowRoles("delivery"),
  async (req, res) => {
    try {
      // Gộp 2 loại: đơn chờ giao (accepted) + đơn đang giao bởi người này
      const orders = await Order.find({
        $or: [
          { status: "accepted" }, // nhà hàng đã xác nhận
          { status: "in-transit", deliveryPersonId: req.user.id },
          { status: "delivered", deliveryPersonId: req.user.id }, // đã giao
        ],
      });
      res.json(orders);
    } catch (err) {
      console.error("Error fetching delivery orders:", err.message);
      res.status(500).json({ message: "Error fetching delivery orders" });
    }
  }
);

// 🧾 All not delivered yet
// ✅ Endpoint cho Delivery hiển thị đơn hàng
router.get(
  "/order/delivery/all",
  verifyToken,
  allowRoles("delivery"),
  async (req, res) => {
    try {
      const orders = await Order.find({
        $or: [
          { status: "accepted" }, // đơn đã được nhà hàng xác nhận, chờ giao
          { status: "in-transit", deliveryPersonId: req.user.id }, // đơn đang giao
        ],
      });
      res.json(orders);
    } catch (err) {
      console.error("Error fetching delivery all:", err.message);
      res.status(500).json({ message: "Error fetching delivery all" });
    }
  }
);

/* ===========================
   🧑‍💼 ADMIN ROUTES
=========================== */
// NOTE: admin routes (including `/admin/stats`) are implemented in
// `routes/admin.js`. We remove the duplicate implementation here to
// avoid route conflicts so that the dedicated admin router handles
// authentication/enrichment consistently.

module.exports = router;
