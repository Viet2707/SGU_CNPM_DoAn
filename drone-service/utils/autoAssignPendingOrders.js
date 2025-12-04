const axios = require("axios");
const Drone = require("../models/Drone");
const { assignDroneToOrder } = require("./assignDrone");

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || "http://order-service:5003";

/**
 * Tự động assign tất cả order pending cho các drone idle available
 * Được gọi khi:
 * - Admin bật lại drone (isActive = true)
 * - Drone hoàn thành giao hàng và trở về idle
 */
async function autoAssignPendingOrders() {
  try {
    console.log("🔍 Checking for pending orders and idle drones...");

    // 1. Lấy tất cả order đang pending (accepted, chưa có drone)
    const availRes = await axios.get(
      `${ORDER_SERVICE_URL}/orders/available/drone?limit=50`
    );
    const pendingOrders = Array.isArray(availRes.data)
      ? availRes.data
      : availRes.data._id
      ? [availRes.data]
      : [];

    if (pendingOrders.length === 0) {
      console.log("✅ No pending orders to assign");
      return { assigned: 0, pending: 0 };
    }

    console.log(`📦 Found ${pendingOrders.length} pending orders`);

    // 2. Lấy tất cả drone idle và active
    const idleDrones = await Drone.find({ status: "idle", isActive: true });

    if (idleDrones.length === 0) {
      console.log("⚠️ No idle drones available");
      return { assigned: 0, pending: pendingOrders.length };
    }

    console.log(`🚁 Found ${idleDrones.length} idle drones`);

    // 3. Assign từng order cho từng drone
    let assignedCount = 0;
    for (let i = 0; i < Math.min(pendingOrders.length, idleDrones.length); i++) {
      const order = pendingOrders[i];
      const drone = idleDrones[i];

      console.log(`🔗 Assigning order ${order._id} to drone ${drone.code}`);
      const success = await assignDroneToOrder(drone, order);

      if (success) {
        assignedCount++;
        console.log(`✅ Successfully assigned order ${order._id}`);
      } else {
        console.log(`❌ Failed to assign order ${order._id}`);
      }
    }

    console.log(
      `✅ Auto-assign completed: ${assignedCount}/${pendingOrders.length} orders assigned`
    );

    return {
      assigned: assignedCount,
      pending: pendingOrders.length - assignedCount,
    };
  } catch (err) {
    console.error("❌ Auto-assign pending orders error:", err.message);
    return { assigned: 0, pending: 0, error: err.message };
  }
}

module.exports = { autoAssignPendingOrders };
