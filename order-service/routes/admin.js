const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { verifyToken, allowRoles } = require("../utils/authMiddleware");
const axios = require("axios");

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://auth-service:5001";
const RESTAURANT_SERVICE_URL = process.env.RESTAURANT_SERVICE_URL || "http://restaurant-service:5002";

/**
 * GET /admin/stats
 * Hiển thị thống kê tổng quan cho admin:
 * - Tổng đơn, tổng doanh thu
 * - Breakdown theo restaurant, delivery, customer
 * - Doanh thu chia tỉ lệ (80/15/5)
 */
router.get("/stats", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    // ✅ 1. Tổng đơn
    const totalOrders = await Order.countDocuments();

    // ✅ 2. Tổng doanh thu (chỉ đơn delivered)
    const revenueAgg = await Order.aggregate([
      { $match: { status: "delivered" } },
      { $group: { _id: null, totalRevenue: { $sum: { $ifNull: ["$total", 0] } } } },
    ]);
    const totalRevenue = revenueAgg?.[0]?.totalRevenue || 0;

    // ✅ 3. Thêm trường chia tiền (80/15/5)
    const COMMISSION = { restaurant: 0.8, delivery: 0.15, platform: 0.05 };

    // ✅ 4. Breakdown theo nhà hàng
    const restaurantAgg = await Order.aggregate([
      { $match: { status: "delivered" } },
      {
        $group: {
          _id: "$restaurantId",
          orders: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
      {
        $project: {
          restaurantId: "$_id",
          _id: 0,
          orders: 1,
          revenue: "$total",
          restaurantShare: { $multiply: ["$total", COMMISSION.restaurant] },
          deliveryShare: { $multiply: ["$total", COMMISSION.delivery] },
          platformShare: { $multiply: ["$total", COMMISSION.platform] },
        },
      },
    ]);

    // ✅ 5. Breakdown theo người giao hàng
    const deliveryAgg = await Order.aggregate([
      { $match: { status: "delivered" } },
      {
        $group: {
          _id: "$deliveryPersonId",
          orders: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
      {
        $project: {
          deliveryPersonId: "$_id",
          _id: 0,
          orders: 1,
          revenue: "$total",
          restaurantShare: { $multiply: ["$total", COMMISSION.restaurant] },
          deliveryShare: { $multiply: ["$total", COMMISSION.delivery] },
          platformShare: { $multiply: ["$total", COMMISSION.platform] },
        },
      },
    ]);

    // ✅ 6. Breakdown theo khách hàng
    const customerAgg = await Order.aggregate([
      { $match: { status: "delivered" } },
      {
        $group: {
          _id: "$customerId",
          orders: { $sum: 1 },
          totalSpent: { $sum: "$total" },
        },
      },
      { $sort: { totalSpent: -1 } },
    ]);

    // ✅ 7. Enrich dữ liệu từ auth-service (name, email)
   let userMap = {};
try {
  const r = await axios.get(`${AUTH_SERVICE_URL}/auth/users`, {
    headers: { Authorization: req.headers.authorization || "" },
    timeout: 5000,
  });

  if (Array.isArray(r.data)) {
    for (const u of r.data) {
      if (u?._id) {
        userMap[String(u._id)] = {
          name: u.username || u.name || u.email || "User",
          email: u.email || "N/A",
          role: u.role || "unknown",
        };
      }
    }
  }
} catch (e) {
  console.warn("⚠️ Enrich user info failed:", e.message);
}

    // ✅ 8. Enrich tên nhà hàng (tùy chọn)
    let restaurantMap = {};
    try {
      const r = await axios.get(`${RESTAURANT_SERVICE_URL}/restaurant/api/restaurants`, {
        headers: { Authorization: req.headers.authorization || "" },
        timeout: 4000,
      });
      if (Array.isArray(r.data)) {
        for (const rest of r.data) {
          if (rest?._id) restaurantMap[String(rest._id)] = rest.name || "Restaurant";
        }
      }
    } catch (e) {
      console.warn("⚠️ Enrich restaurant failed:", e.message);
    }

    // ✅ 9. Gắn thông tin enrich
    const restaurantBreakdown = restaurantAgg.map((r) => ({
      restaurantId: r.restaurantId,
      restaurantName: restaurantMap[r.restaurantId] || "Unknown Restaurant",
      orders: r.orders,
      revenue: r.revenue,
      shares: {
        restaurant: r.restaurantShare,
        delivery: r.deliveryShare,
        platform: r.platformShare,
      },
    }));

    const deliveryBreakdown = deliveryAgg.map((d) => ({
      deliveryPersonId: d.deliveryPersonId,
      deliveryName: userMap[d.deliveryPersonId]?.name || "Unknown Delivery",
      orders: d.orders,
      revenue: d.revenue,
      shares: {
        restaurant: d.restaurantShare,
        delivery: d.deliveryShare,
        platform: d.platformShare,
      },
    }));

    const customerBreakdown = customerAgg.map((c) => ({
      customerId: c._id,
      customerName: userMap[c._id]?.name || "Unknown Customer",
      email: userMap[c._id]?.email || "N/A",
      orders: c.orders,
      totalSpent: c.totalSpent,
    }));

    // ✅ 10. Trả kết quả tổng hợp
    res.json({
      totalOrders,
      totalRevenue,
      commissionRate: COMMISSION,
      restaurantBreakdown,
      deliveryBreakdown,
      customerBreakdown,
    });
  } catch (err) {
    console.error("Admin stats error:", err.message);
    res.status(500).json({ message: "Failed to fetch admin stats", error: err.message });
  }
});

module.exports = router;
