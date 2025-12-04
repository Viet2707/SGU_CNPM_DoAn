// routes/adminDrone.js
const express = require("express");
const router = express.Router();
const Drone = require("../models/Drone");
const { verifyToken, allowRoles } = require("../utils/authMiddleware");

// Lấy danh sách drone (kèm filter)
router.get("/", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const { status, isActive } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    const drones = await Drone.find(filter).sort({ createdAt: -1 });
    res.json(drones);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch drones" });
  }
});

// Lấy chi tiết 1 drone
router.get("/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const drone = await Drone.findById(req.params.id);
    if (!drone) return res.status(404).json({ message: "Drone not found" });
    res.json(drone);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch drone" });
  }
});

// Tạo drone mới
router.post("/", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const { code, name, baseLocation, capacityKg } = req.body;
    const drone = await Drone.create({
      code,
      name,
      baseLocation,
      capacityKg,
    });
    res.status(201).json(drone);
  } catch (err) {
    res.status(500).json({ message: "Failed to create drone" });
  }
});

// Cập nhật drone
router.put("/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const update = req.body; // cho phép sửa name, baseLocation, capacityKg, isActive, ...
    
    // Nếu admin cố gắng disable drone (isActive = false), kiểm tra trạng thái
    if (update.isActive === false) {
      const drone = await Drone.findById(req.params.id);
      if (!drone) return res.status(404).json({ message: "Drone not found" });
      
      if (drone.status !== "idle") {
        return res.status(400).json({ 
          message: `Không thể disable drone khi đang ở trạng thái "${drone.status}". Chỉ có thể disable khi drone đang "idle"`,
          currentStatus: drone.status
        });
      }
    }
    
    const drone = await Drone.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });
    if (!drone) return res.status(404).json({ message: "Drone not found" });
    
    // 🔥 Nếu admin bật lại drone (isActive = true)
    // → Tự động assign tất cả order pending cho các drone idle
    if (update.isActive === true) {
      try {
        const { autoAssignPendingOrders } = require("../utils/autoAssignPendingOrders");
        // Chạy async không chờ để không block response
        setImmediate(() => {
          autoAssignPendingOrders().catch(err => {
            console.error("Background auto-assign failed:", err.message);
          });
        });
      } catch (e) {
        console.warn("Auto-assign trigger failed:", e.message);
      }
    }
    
    res.json(drone);
  } catch (err) {
    res.status(500).json({ message: "Failed to update drone" });
  }
});

// Disable drone (soft delete)
router.patch("/:id/disable", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const drone = await Drone.findById(req.params.id);
    if (!drone) return res.status(404).json({ message: "Drone not found" });
    
    // Kiểm tra trạng thái drone - chỉ cho phép disable khi idle
    if (drone.status !== "idle") {
      return res.status(400).json({ 
        message: `Không thể disable drone khi đang ở trạng thái "${drone.status}". Chỉ có thể disable khi drone đang "idle"`,
        currentStatus: drone.status
      });
    }
    
    // Cập nhật isActive = false
    drone.isActive = false;
    await drone.save();
    
    res.json({ message: "Drone disabled", drone });
  } catch (err) {
    res.status(500).json({ message: "Failed to disable drone" });
  }
});

// 🔄 Manual trigger auto-assign pending orders
router.post("/auto-assign", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const { autoAssignPendingOrders } = require("../utils/autoAssignPendingOrders");
    const result = await autoAssignPendingOrders();
    res.json({
      message: "Auto-assign completed",
      ...result
    });
  } catch (err) {
    console.error("Manual auto-assign failed:", err.message);
    res.status(500).json({ message: "Failed to auto-assign orders" });
  }
});

// Xóa drone vĩnh viễn (kiểm tra orders trước)
router.delete("/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if drone exists
    const drone = await Drone.findById(id);
    if (!drone) {
      return res.status(404).json({ message: "Drone not found" });
    }

    // Check if drone has orders by calling order-service
    const axios = require("axios");
    const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || "http://order-service:5003";
    
    try {
      console.log(`[DELETE DRONE] Checking orders for drone ${id} at ${ORDER_SERVICE_URL}/orders/drone/${id}`);
      const orderCheck = await axios.get(`${ORDER_SERVICE_URL}/orders/drone/${id}`, {
        timeout: 3000
      });
      
      console.log(`[DELETE DRONE] Order check response:`, orderCheck.data);
      
      if (orderCheck.data && orderCheck.data.length > 0) {
        console.log(`[DELETE DRONE] Drone ${id} has ${orderCheck.data.length} orders, cannot delete`);
        return res.status(400).json({ 
          message: "Cannot delete drone with existing orders",
          orderCount: orderCheck.data.length 
        });
      }
      
      console.log(`[DELETE DRONE] Drone ${id} has no orders, proceeding with deletion`);
    } catch (orderErr) {
      // If order service is down, we should NOT allow deletion for safety
      console.error("[DELETE DRONE] Error checking orders:", orderErr.message);
      return res.status(503).json({ 
        message: "Cannot verify order status. Please try again later.",
        error: orderErr.message 
      });
    }

    // Delete the drone
    await Drone.findByIdAndDelete(id);
    console.log(`[DELETE DRONE] Successfully deleted drone ${id}`);
    res.json({ message: "Drone deleted successfully" });
  } catch (err) {
    console.error("Failed to delete drone:", err.message);
    res.status(500).json({ message: "Failed to delete drone" });
  }
});

module.exports = router;
