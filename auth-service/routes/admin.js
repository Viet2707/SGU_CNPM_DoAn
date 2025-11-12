const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { verifyToken, allowRoles } = require("../utils/jwt");

// Get all users (admin only)
router.get("/users", verifyToken, allowRoles("admin"), async (req, res) => {
  const users = await User.find({}, "-password"); // exclude passwords
  res.send(users);
});

// Get all restaurants (admin only)
router.get(
  "/restaurants",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    const restaurants = await User.find({ role: "restaurant" }, "-password");
    res.send(restaurants);
  }
);

// Bulk user info (ids) - used by other services to enrich reports
// NOTE: this endpoint is intended for internal service-to-service enrichment
// We keep it unprotected for simplicity in the local/dev environment.
router.post("/users/bulk-info", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids))
      return res.status(400).json({ message: "ids must be an array" });
    const users = await User.find({ _id: { $in: ids } }, "_id name email role");
    res.json(users);
  } catch (err) {
    console.error("bulk-info error", err.message);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});
// Approve a restaurant (mock example – add status flag)
router.patch(
  "/verify-restaurant/:id",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    const { id } = req.params;
    await User.findByIdAndUpdate(id, { verified: true });
    res.send({ message: "Restaurant verified" });
  }
);

module.exports = router;
