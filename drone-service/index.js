// drone-service/index.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const axios = require("axios"); // 🔹 NHỚ IMPORT axios
const { subscribeEvent, publishEvent } = require("./rabbitmq");
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

      // 🟡 Cập nhật trạng thái drone → in-transit
      drone.status = "in-transit";
      drone.assignedOrderId = payload.orderId;

      // Nếu drone đã có baseLocation thì dùng
      // Nếu chưa thì đặt tại nhà hàng
      drone.currentLocation = drone.baseLocation || {
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
      };

      await drone.save();

      console.log("🚁 Assigned drone:", drone.code);

      // GỌI ORDER-SERVICE để gán drone vào order
      try {
        await axios.patch(
          `${ORDER_SERVICE_URL}/orders/${payload.orderId}/assign-drone`,
          {
            droneId: drone._id,
            drone: {
              droneId: drone._id,
              code: drone.code,
              name: drone.name,
              batteryPercent: drone.batteryPercent,
              currentLocation: drone.currentLocation,
            },
          }
        );
      } catch (err) {
        console.error(
          "❌ Failed to notify order-service about assigned drone:",
          err.message
        );
      }

      // 2. Drone bắt đầu tại vị trí nhà hàng
      let dronePos = {
        latitude: drone.currentLocation.latitude,
        longitude: drone.currentLocation.longitude,
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
          // 🔵 Cập nhật vị trí drone trong DB
          drone.currentLocation = {
            latitude: dronePos.latitude,
            longitude: dronePos.longitude,
          };

          await drone.save();

          // Cập nhật droneLocation + status vào order-service
          await axios.patch(
            `${ORDER_SERVICE_URL}/orders/${payload.orderId}/drone-location`,
            {
              latitude: dronePos.latitude,
              longitude: dronePos.longitude,
              droneId: drone._id,
            }
          );

          // Nếu đã tới nơi thì dừng
          if (
            Math.abs(dronePos.latitude - customer.latitude) < 0.0005 &&
            Math.abs(dronePos.longitude - customer.longitude) < 0.0005
          ) {
            clearInterval(interval);

            // Drone đã tới vị trí khách hàng – chờ khách xác nhận giao hàng
            drone.waitingForCustomerConfirmation = true;
            // giữ drone.status là in-transit cho đến khi khách xác nhận
            await drone.save();

            console.log(
              "🟡 Drone arrived and is waiting for customer confirmation:",
              payload.orderId
            );
          }
        } catch (err) {
          console.error("❌ Error while moving drone:", err.message);
        }
      }, 1000);
    } catch (err) {
      console.error("❌ Error in drone-service event handler:", err.message);
    }
  }
);

app.listen(process.env.PORT || 5009, () => {
  console.log(`🚁 Drone Service running on port ${process.env.PORT || 5009}`);
});
