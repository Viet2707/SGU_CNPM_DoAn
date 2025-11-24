// drone-service/index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const axios = require("axios"); // 🔹 NHỚ IMPORT axios

const { subscribeEvent, publishEvent } = require("./rabbitmq");
const droneRoutes = require("./routes/drone");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/", droneRoutes);

// =============================
// 🔧 Hàm tính bước di chuyển
// =============================
function moveTowards(current, target, step = 0.0005) {
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

      // 2. Drone bắt đầu tại vị trí nhà hàng
      let dronePos = {
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
      };

      console.log("🚁 Drone starting at:", dronePos);

      // 3. Gửi event đánh dấu "đang giao" (in-transit) – optional
      await publishEvent("delivery.in_transit", {
        orderId: payload.orderId,
        status: "in-transit",
      });

      // 4. Cứ 3 giây thì drone bay thêm 1 đoạn & cập nhật lên order-service
      const interval = setInterval(async () => {
        try {
          dronePos = moveTowards(dronePos, customer);

          console.log("🚁 Drone moving:", dronePos);

          // Cập nhật droneLocation + status vào order-service
          await axios.patch(
            `${ORDER_SERVICE_URL}/orders/${payload.orderId}/drone-location`,
            {
              latitude: dronePos.latitude,
              longitude: dronePos.longitude,
            }
          );

          // Nếu đã tới nơi thì dừng
          if (
            Math.abs(dronePos.latitude - customer.latitude) < 0.0001 &&
            Math.abs(dronePos.longitude - customer.longitude) < 0.0001
          ) {
            clearInterval(interval);

            // Báo đơn đã giao xong
            await axios.patch(
              `${ORDER_SERVICE_URL}/orders/${payload.orderId}/drone-delivered`
            );

            console.log("🎉 Drone delivered order:", payload.orderId);
          }
        } catch (err) {
          console.error("❌ Error while moving drone:", err.message);
        }
      }, 3000);
    } catch (err) {
      console.error("❌ Error in drone-service event handler:", err.message);
    }
  }
);

app.listen(process.env.PORT || 5009, () => {
  console.log(`🚁 Drone Service running on port ${process.env.PORT || 5009}`);
});
