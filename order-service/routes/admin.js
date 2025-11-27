const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { verifyToken, allowRoles } = require("../utils/authMiddleware");
const axios = require("axios");

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://auth-service:5001";
const RESTAURANT_SERVICE_URL =
  process.env.RESTAURANT_SERVICE_URL || "http://restaurant-service:5002";

// Create axios instance with timeout for internal calls to avoid long hangs
const http = axios.create({ timeout: 3000 });

/**
 * GET /admin/stats
 * Hiển thị thống kê tổng quan cho admin:
 * - Tổng đơn, tổng doanh thu
 * - Breakdown theo restaurant, delivery, customer
 * - Doanh thu chia tỉ lệ (80/15/5)
 */
// ✅ Admin thống kê tổng hợp
router.get("/stats", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    // ⛳ 1) Chỉ tính đơn hàng đã giao thành công
    const deliveredFilter = { status: "delivered" };

    // Tổng số đơn delivered
    const totalOrders = await Order.countDocuments(deliveredFilter);

    // Tổng doanh thu delivered
    const totalRevenueAgg = await Order.aggregate([
      { $match: deliveredFilter }, // ⭐ thêm match
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const totalRevenue = totalRevenueAgg[0]?.total || 0;

    // Báo cáo theo nhà hàng — chỉ delivered
    const restaurantAgg = await Order.aggregate([
      { $match: deliveredFilter }, // ⭐ thêm match
      {
        $group: {
          _id: "$restaurantId",
          orders: { $sum: 1 },
          revenue: { $sum: "$total" },
        },
      },
    ]);

    // Báo cáo theo tài xế — chỉ delivered
    const deliveryAgg = await Order.aggregate([
      { $match: deliveredFilter }, // ⭐ thêm match
      {
        $group: {
          _id: "$deliveryPersonId",
          orders: { $sum: 1 },
          revenue: { $sum: "$total" },
        },
      },
    ]);

    // Báo cáo theo khách hàng — chỉ delivered
    const customerAgg = await Order.aggregate([
      { $match: deliveredFilter }, // ⭐ thêm match
      {
        $group: {
          _id: "$customerId",
          orders: { $sum: 1 },
          totalSpent: { $sum: "$total" },
        },
      },
    ]);

    /* ---- GIỮ NGUYÊN PHẦN FETCH RESTAURANT + USER INFO ---- */

    let restaurantNames = {};
    try {
      const resp = await http.get(`${RESTAURANT_SERVICE_URL}/api/restaurants`);
      if (Array.isArray(resp.data)) {
        resp.data.forEach((r) => {
          restaurantNames[r._id || r._id?.toString()] =
            r.name || r.restaurantName || r.name;
        });
      }
    } catch (e) {
      console.warn("Warning: failed to fetch restaurant names:", e.message);
    }

    async function getUserNames(ids) {
      if (!ids.length) return {};
      try {
        const resp = await http.post(
          `${AUTH_SERVICE_URL}/admin/users/bulk-info`,
          { ids }
        );
        const map = {};
        resp.data.forEach((u) => {
          map[u._id] = u;
        });
        return map;
      } catch (e) {
        return {};
      }
    }

    const deliveryIds = deliveryAgg.map((d) => d._id).filter(Boolean);
    const customerIds = customerAgg.map((c) => c._id).filter(Boolean);
    const deliveryUsers = await getUserNames(deliveryIds);
    const customerUsers = await getUserNames(customerIds);

    // Giữ nguyên logic chia shares
    function calcShares(total) {
      return {
        restaurant: Math.round(total * 0.8),
        delivery: Math.round(total * 0.15),
        platform: Math.round(total * 0.05),
      };
    }

    const restaurantBreakdown = restaurantAgg.map((r) => ({
      restaurantName: restaurantNames[r._id] || r._id,
      orders: r.orders,
      revenue: r.revenue,
      shares: calcShares(r.revenue),
    }));

    const deliveryBreakdown = deliveryAgg.map((d) => {
      const idKey = d._id || "unassigned";
      return {
        deliveryId: idKey,
        deliveryName:
          deliveryUsers[d._id]?.name || (d._id ? d._id : "Unassigned"),
        orders: d.orders,
        revenue: d.revenue,
        shares: calcShares(d.revenue),
      };
    });

    const customerBreakdown = customerAgg.map((c) => ({
      customerName: c._id,
      email: customerUsers[c._id]?.username || "-",
      orders: c.orders,
      totalSpent: c.totalSpent,
    }));

    res.json({
      totalOrders,
      totalRevenue,
      restaurantAgg: restaurantBreakdown,
      deliveryAgg: deliveryBreakdown,
      customerAgg: customerBreakdown,
    });
  } catch (err) {
    console.error("Error fetching admin stats:", err.message);
    res.status(500).json({ message: "Failed to fetch admin stats" });
  }
});

// ✅ Get delivered count for a given drone (admin)
router.get(
  "/drone/:droneId/delivered-count",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const { droneId } = req.params;
      if (!droneId) return res.status(400).json({ message: "Missing droneId" });

      const filter = {
        status: "delivered",
        deliveryMethod: "drone",
        $or: [{ droneId: droneId }, { "drone.droneId": droneId }],
      };

      const count = await Order.countDocuments(filter);
      res.json({ droneId, delivered: count });
    } catch (err) {
      console.error("Error fetching drone delivered count:", err.message);
      res.status(500).json({ message: "Failed to fetch delivered count" });
    }
  }
);

module.exports = router;
