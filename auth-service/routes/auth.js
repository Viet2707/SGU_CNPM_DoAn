const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { generateToken } = require("../utils/jwt");
const { verifyToken, allowRoles } = require("../utils/jwt");

const router = express.Router();

// 🧩 Register
router.post("/register", async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashed, role });
    await newUser.save();
    res.status(201).send({ message: "User registered successfully" });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// 🔑 Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).send({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).send({ error: "Invalid password" });

    const token = generateToken(user);
    res.send({ token, role: user.role });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send({ error: "Server error" });
  }
});

// 👑 Get all users (admin only)
router.get("/users", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const users = await User.find({}, "_id username email role");
    res.json(users);
  } catch (err) {
    console.error("Failed to fetch users:", err.message);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// 🔥 NEW: return info of multiple users
router.post("/admin/users/bulk-info", async (req, res) => {
  try {
    const { ids } = req.body;

    const users = await User.find({ _id: { $in: ids } }, "_id username role");

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Bulk user lookup failed" });
  }
});

module.exports = router;
