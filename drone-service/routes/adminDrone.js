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
    const drone = await Drone.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });
    if (!drone) return res.status(404).json({ message: "Drone not found" });
    res.json(drone);
  } catch (err) {
    res.status(500).json({ message: "Failed to update drone" });
  }
});

// Xóa drone (nên soft delete)
router.delete("/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    // Option 1: soft delete
    const drone = await Drone.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!drone) return res.status(404).json({ message: "Drone not found" });
    res.json({ message: "Drone disabled", drone });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete drone" });
  }
});

module.exports = router;
