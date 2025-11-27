// drone-service/index.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const axios = require("axios"); // 🔹 NHỚ IMPORT axios
const { subscribeEvent, publishEvent } = require("./rabbitmq");
const { assignDroneToOrder } = require("./utils/assignDrone");
const droneRoutes = require("./routes/drone");
const adminDroneRoutes = require("./routes/adminDrone");
const Drone = require("./models/Drone");

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 Connect Mongo Atlas (dronedb)
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Drone DB connected"))
  .catch((err) => console.error("Drone DB error:", err.message));

app.use("/", droneRoutes);
app.use("/admin/drones", adminDroneRoutes);

// =============================
// 🔧 Hàm tính bước di chuyển
// =============================
function moveTowards(current, target, step = 0.002) {
  const dx = target.latitude - current.latitude;
  const dy = target.longitude - current.longitude;

  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < step) return target; // gần tới nơi thì coi như tới

  return {
    latitude: current.latitude + (dx / distance) * step,
    longitude: current.longitude + (dy / distance) * step,
  };
}

// 📥 Khi nhà hàng accept đơn drone
subscribeEvent(
  "drone-service-order-queue",
  ["order.accepted.drone"],
  async (payload) => {
    try {
      console.log("📥 [Drone-Service] order.accepted.drone:", payload);

      const ORDER_SERVICE_URL =
        process.env.ORDER_SERVICE_URL || "http://order-service:5003";

      // 1. Lấy order để biết tọa độ nhà hàng & khách
      const orderRes = await axios.get(
        `${ORDER_SERVICE_URL}/orders/${payload.orderId}`
      );
      const order = orderRes.data;

      const restaurant = order.restaurantLocation; // bạn đã lưu sẵn lúc tạo order
      const customer = order.deliveryLocation;

      if (!restaurant || !customer) {
        console.error("❌ Missing restaurant or customer location");
        return;
      }

      // 🔍 Tìm drone rảnh
      const drone = await Drone.findOne({ status: "idle", isActive: true });

      if (!drone) {
        console.error("❌ No idle drone available!");
        return;
      }

      // Reuse module helper assignDroneToOrder
      const assigned = await assignDroneToOrder(drone, order);
      if (assigned) console.log("🚁 Assigned drone:", drone.code);
    } catch (err) {
      console.error("❌ Error in drone-service event handler:", err.message);
    }
  }
);

app.listen(process.env.PORT || 5009, () => {
  console.log(`🚁 Drone Service running on port ${process.env.PORT || 5009}`);
});
