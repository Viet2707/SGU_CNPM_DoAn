const express = require("express");
const router = express.Router();
const axios = require("axios");
const { verifyToken, allowRoles } = require("../utils/authMiddleware");

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL;

// 🚚 Get assigned or available orders
// ✅ Lấy tất cả orders để hiển thị cho delivery
router.get("/orders", verifyToken, allowRoles("delivery"), async (req, res) => {
  try {
    const response = await axios.get(
      "http://order-service:5003/order/delivery/orders",
      {
        headers: { Authorization: req.headers.authorization },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching delivery orders:", error.message);
    res.status(500).json({ message: "Error fetching delivery orders" });
  }
});

router.get("/all", verifyToken, allowRoles("delivery"), async (req, res) => {
  try {
    const response = await axios.get(
      `http://order-service:5003/order/delivery/all`,
      {
        headers: {
          Authorization: req.headers.authorization,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Error fetching delivery orders" });
  }
});

// ✅ Update delivery status
// ✅ Delivery claim order (set to in-transit)
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

      const response = await axios.patch(
        `http://order-service:5003/status/${id}`,
        { status },
        { headers: { Authorization: req.headers.authorization } }
      );

      res.json(response.data);
    } catch (err) {
      console.error("Error claiming order:", err.message);
      res.status(500).json({ message: "Failed to claim order" });
    }
  }
);

module.exports = router;
