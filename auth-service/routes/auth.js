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

    // Check if account is locked
    if (user.isLocked) {
      return res.status(403).send({ 
        error: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.",
        lockReason: user.lockReason || "Không có lý do cụ thể"
      });
    }

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

    const users = await User.find({ _id: { $in: ids } }, "_id username role isLocked lockReason");

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Bulk user lookup failed" });
  }
});

// 🔥 Admin login
router.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username, role: "admin" });
    if (!user) return res.status(404).send({ error: "Admin not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).send({ error: "Invalid password" });

    const token = generateToken(user);
    res.send({ token });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).send({ error: "Server error" });
  }
});

// 👥 Get all customers (admin only)
router.get("/admin/customers", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" }, "_id username email verified isLocked lockReason lockHistory createdAt");
    res.json(customers);
  } catch (err) {
    console.error("Failed to fetch customers:", err.message);
    res.status(500).json({ message: "Failed to fetch customers" });
  }
});

// 🗑️ Delete customer (admin only) - check if customer has orders first
router.delete("/admin/customers/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if customer exists
    const customer = await User.findById(id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    
    if (customer.role !== "customer") {
      return res.status(403).json({ message: "Can only delete customer accounts" });
    }

    // Check if customer has orders by calling order-service
    const axios = require("axios");
    const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || "http://order-service:5003";
    
    try {
      console.log(`[DELETE CUSTOMER] Checking orders for customer ${id} at ${ORDER_SERVICE_URL}/orders/customer/${id}`);
      const orderCheck = await axios.get(`${ORDER_SERVICE_URL}/orders/customer/${id}`, {
        timeout: 3000
      });
      
      console.log(`[DELETE CUSTOMER] Order check response:`, orderCheck.data);
      
      if (orderCheck.data && orderCheck.data.length > 0) {
        console.log(`[DELETE CUSTOMER] Customer ${id} has ${orderCheck.data.length} orders, cannot delete`);
        return res.status(400).json({ 
          message: "Cannot delete customer with existing orders",
          orderCount: orderCheck.data.length 
        });
      }
      
      console.log(`[DELETE CUSTOMER] Customer ${id} has no orders, proceeding with deletion`);
    } catch (orderErr) {
      // If order service is down, we should NOT allow deletion for safety
      console.error("[DELETE CUSTOMER] Error checking orders:", orderErr.message);
      console.error("[DELETE CUSTOMER] Full error:", orderErr.response?.data || orderErr);
      return res.status(503).json({ 
        message: "Cannot verify order status. Please try again later.",
        error: orderErr.message 
      });
    }

    // Delete the customer
    await User.findByIdAndDelete(id);
    console.log(`[DELETE CUSTOMER] Successfully deleted customer ${id}`);
    res.json({ message: "Customer deleted successfully" });
  } catch (err) {
    console.error("Failed to delete customer:", err.message);
    res.status(500).json({ message: "Failed to delete customer" });
  }
});

// 🗑️ Delete any user by ID (admin only) - used by other services
router.delete("/admin/users/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete the user
    await User.findByIdAndDelete(id);
    console.log(`[DELETE USER] Successfully deleted user ${id} (${user.role})`);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Failed to delete user:", err.message);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// 🔒 Lock/Unlock customer account (admin only)
router.patch("/admin/customers/:id/lock", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { isLocked, reason } = req.body;
    
    // Check if customer exists
    const customer = await User.findById(id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    
    if (customer.role !== "customer") {
      return res.status(403).json({ message: "Can only lock/unlock customer accounts" });
    }

    // Nếu đang khóa (isLocked = true), kiểm tra đơn hàng pending
    if (isLocked) {
      const axios = require("axios");
      const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || "http://order-service:5003";
      
      try {
        const pendingCheckResponse = await axios.get(
          `${ORDER_SERVICE_URL}/admin/customer/${id}/has-pending-orders`,
          {
            headers: { Authorization: req.headers.authorization },
            timeout: 3000
          }
        );

        if (pendingCheckResponse.data.hasPendingOrders) {
          return res.status(400).json({
            message: `Không thể khóa khách hàng vì còn ${pendingCheckResponse.data.pendingOrderCount} đơn hàng chưa giao xong`,
            pendingOrderCount: pendingCheckResponse.data.pendingOrderCount,
          });
        }
      } catch (err) {
        console.error("Error checking customer pending orders:", err.message);
        return res.status(500).json({
          message: "Không thể kiểm tra đơn hàng đang chờ của khách hàng",
        });
      }
    }

    // Update lock status
    customer.isLocked = isLocked;
    customer.lockReason = isLocked ? (reason || "Không có lý do cụ thể") : null;
    
    // Add to lock history
    if (!customer.lockHistory) {
      customer.lockHistory = [];
    }
    customer.lockHistory.push({
      action: isLocked ? 'locked' : 'unlocked',
      reason: reason || (isLocked ? "Không có lý do cụ thể" : "Mở khóa bởi admin"),
      adminId: req.user.id,
      timestamp: new Date()
    });
    
    await customer.save();
    
    console.log(`[LOCK CUSTOMER] ${isLocked ? 'Locked' : 'Unlocked'} customer ${id} - Reason: ${reason || 'N/A'}`);
    res.json({ 
      message: `Customer ${isLocked ? 'locked' : 'unlocked'} successfully`,
      isLocked: customer.isLocked,
      lockReason: customer.lockReason
    });
  } catch (err) {
    console.error("Failed to lock/unlock customer:", err.message);
    res.status(500).json({ message: "Failed to lock/unlock customer" });
  }
});

// 🔒 Lock/Unlock any user account (admin only) - used by other services
router.patch("/admin/users/:id/lock", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { isLocked, reason } = req.body;
    
    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update lock status
    user.isLocked = isLocked;
    user.lockReason = isLocked ? (reason || "Không có lý do cụ thể") : null;
    
    // Add to lock history
    if (!user.lockHistory) {
      user.lockHistory = [];
    }
    user.lockHistory.push({
      action: isLocked ? 'locked' : 'unlocked',
      reason: reason || (isLocked ? "Không có lý do cụ thể" : "Mở khóa bởi admin"),
      adminId: req.user.id,
      timestamp: new Date()
    });
    
    await user.save();
    
    console.log(`[LOCK USER] ${isLocked ? 'Locked' : 'Unlocked'} user ${id} (${user.role}) - Reason: ${reason || 'N/A'}`);
    res.json({ 
      message: `User ${isLocked ? 'locked' : 'unlocked'} successfully`,
      isLocked: user.isLocked,
      lockReason: user.lockReason
    });
  } catch (err) {
    console.error("Failed to lock/unlock user:", err.message);
    res.status(500).json({ message: "Failed to lock/unlock user" });
  }
});

module.exports = router;
