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
    // totalOrders: count all orders (so totals match breakdowns which are across all statuses)
    const totalOrders = await Order.countDocuments();
    const totalRevenueAgg = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const totalRevenue = totalRevenueAgg[0]?.total || 0;

    // Thống kê theo nhà hàng (tất cả đơn)
    const restaurantAgg = await Order.aggregate([
      {
        $group: {
          _id: "$restaurantId",
          orders: { $sum: 1 },
          revenue: { $sum: "$total" },
        },
      },
    ]);

    // Thống kê theo tài xế (tất cả đơn)
    const deliveryAgg = await Order.aggregate([
      {
        $group: {
          _id: "$deliveryPersonId",
          orders: { $sum: 1 },
          revenue: { $sum: "$total" },
        },
      },
    ]);

    // Thống kê theo khách hàng (tất cả đơn)
    const customerAgg = await Order.aggregate([
      {
        $group: {
          _id: "$customerId",
          orders: { $sum: 1 },
          totalSpent: { $sum: "$total" },
        },
      },
    ]);

    // Lấy tên nhà hàng (nội bộ) - note: restaurant-service exposes /api/restaurants
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

    // Lấy tên tài xế và khách hàng từ auth-service
    async function getUserNames(ids) {
      if (!ids.length) return {};
      try {
        // call auth service internal endpoint
        const resp = await http.post(
          `${AUTH_SERVICE_URL}/admin/users/bulk-info`,
          { ids }
        );
        // resp.data: [{ _id, name, email, role }]
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

    // Tính shares
    function calcShares(total) {
      return {
        restaurant: Math.round(total * 0.8),
        delivery: Math.round(total * 0.15),
        platform: Math.round(total * 0.05),
      };
    }

    // Chuẩn hóa dữ liệu trả về cho frontend
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
      // show the id as the 'name' column and the email if available
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

module.exports = router;
