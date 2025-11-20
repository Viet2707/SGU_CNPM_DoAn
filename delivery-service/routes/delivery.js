// routes/delivery.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const { verifyToken, allowRoles } = require("../utils/authMiddleware");
const { publishEvent } = require("../rabbitmq");

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || "http://order-service:5003";


// --------------------------------------------------
// 📦 GET orders for delivery (available + in-transit)
// --------------------------------------------------
router.get("/orders", verifyToken, allowRoles("delivery"), async (req, res) => {
  try {
    const response = await axios.get(
      `${ORDER_SERVICE_URL}/order/delivery/orders`,
      {
        headers: { Authorization: req.headers.authorization },
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error("Error fetching delivery orders:", err.message);
    res.status(500).json({ message: "Error fetching delivery orders" });
  }
});


// --------------------------------------------------
// 🚚 DELIVERY CLAIM ORDER (→ in-transit, delivered)
// --------------------------------------------------
router.patch(
  "/order/:id",
  verifyToken,
  allowRoles("delivery"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status)
        return res.status(400).json({ message: "Status is required" });

      // Update trạng thái đơn trên order-service
      const response = await axios.patch(
        `${ORDER_SERVICE_URL}/status/${id}`,
        { status },
        { headers: { Authorization: req.headers.authorization } }
      );

      const updatedOrder = response.data.order || response.data;

      // --------------------------------------------------
      // 🔔 Publish event
      // --------------------------------------------------

      if (status === "in-transit") {
        await publishEvent("order.assigned", {
          orderId: id,
          deliveryPersonId: req.user.id,
          restaurantId: updatedOrder.restaurantId,
          customerId: updatedOrder.customerId,
        });

        await publishEvent("delivery.in_transit", {
          orderId: id,
          deliveryPersonId: req.user.id,
        });
      }

      if (status === "delivered") {
        await publishEvent("delivery.completed", {
          orderId: id,
          deliveryPersonId: req.user.id,
        });
      }

      res.json(response.data);
    } catch (err) {
      console.error("Error updating delivery:", err.message);
      res.status(500).json({ message: "Failed to update delivery status" });
    }
  }
);

module.exports = router;
