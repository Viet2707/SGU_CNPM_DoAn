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

    const users = await User.find({ _id: { $in: ids } }).select(
      "_id username role"
    );

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "bulk-info failed" });
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
