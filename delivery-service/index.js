// index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

const { subscribeEvent } = require("./rabbitmq");
const axios = require("axios");

app.use(cors());
app.use(express.json());

// ROUTES
const deliveryRoutes = require("./routes/delivery");
app.use("/", deliveryRoutes);

// 🔥 ORDER-SERVICE BASE URL
const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || "http://order-service:5003";


// --------------------------------------------------
// 🔔 SUBSCRIBE EVENT: order.accepted  (QUAN TRỌNG NHẤT)
// --------------------------------------------------

subscribeEvent(
  "delivery.accept.queue",   // tên queue tạo riêng cho delivery
  ["order.accepted"],        // listen routing key
  async (payload) => {
    console.log("📥 [Delivery] Received order.accepted:", payload);

    // Khi restaurant accept đơn → đơn phải đưa vào trạng thái “available”
    await axios.patch(
      `${ORDER_SERVICE_URL}/status/${payload.orderId}`,
      { status: "available" }
    );

    console.log("🟢 Order now AVAILABLE for delivery:", payload.orderId);
  }
);


// --------------------------------------------------

app.listen(process.env.PORT, () => {
  console.log(`Delivery Service running on port ${process.env.PORT}`);
});
