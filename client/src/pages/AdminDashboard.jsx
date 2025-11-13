import React, { useEffect, useState } from "react";
import axios from "axios";
import '../styles/theme.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("token");
        // Try API Gateway first, then fall back to known order-service ports
        // try direct service ports first (avoid gateway 404 noise), then gateway
        const urls = ["http://localhost:8000/order/admin/stats"];
        let res = null;
        for (const url of urls) {
          try {
            res = await axios.get(url, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 4000,
            });
            if (res && res.status === 200) break;
          } catch (_err) {
            // try next silently (we'll only log once all endpoints fail)
            void _err;
          }
        }
        if (!res) throw new Error("All stats endpoints failed");
        setStats(res.data);
      } catch (err) {
        console.error("Admin stats error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-6 text-white text-lg">Loading dashboard...</div>;
  if (!stats) return <div className="p-6 text-white text-lg">No stats available.</div>;

  const {
    totalOrders,
    totalRevenue,
    restaurantAgg: restaurantBreakdown,
    deliveryAgg: deliveryBreakdown,
    customerAgg: customerBreakdown,
  } = stats;

  return (
    <div className="app-root py-8">
      <div className="container mx-auto">
        <h1 className="orders-title">Admin Dashboard</h1>

        {/* Summary cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="card">
            <div className="text-sm text-gray-400">Total Orders</div>
            <div className="text-2xl font-bold mt-2">{totalOrders}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-400">Total Revenue</div>
            <div className="text-2xl font-bold mt-2">{formatCurrency(totalRevenue)}</div>
          </div>
        </section>

        {/* Restaurant Breakdown */}
        <BreakdownTable
          title="📦 By Restaurant"
          data={restaurantBreakdown}
          columns={[
            { key: "restaurantName", label: "Restaurant" },
            { key: "orders", label: "Orders" },
            { key: "revenue", label: "Revenue" },
            { key: "shares.restaurant", label: "Restaurant Share" },
            { key: "shares.delivery", label: "Delivery Share" },
            { key: "shares.platform", label: "Platform Share" },
          ]}
        />

        {/* Delivery Breakdown */}
        <BreakdownTable
          title="🚚 By Delivery"
          data={deliveryBreakdown}
          columns={[
            { key: "deliveryName", label: "DeliveryId" },
            { key: "orders", label: "Orders" },
            { key: "revenue", label: "Revenue" },
            { key: "shares.restaurant", label: "Restaurant Share" },
            { key: "shares.delivery", label: "Delivery Share" },
            { key: "shares.platform", label: "Platform Share" },
          ]}
        />

        {/* Customer Breakdown */}
        <BreakdownTable
          title="🧍‍♂️ By Customer"
          data={customerBreakdown}
          columns={[
            { key: "customerName", label: "CustomerId" },
            { key: "email", label: "Email" },
            { key: "orders", label: "Orders" },
            { key: "totalSpent", label: "Total Spent" },
          ]}
        />
      </div>
    </div>
  );
}

/* --- Components --- */

function StatCard({ title, value }) {
  return (
    <div className="card">
      <div className="text-sm text-gray-400">{title}</div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </div>
  );
}

function BreakdownTable({ title, data = [], columns = [] }) {
  return (
    <section>
      <h2 className="text-2xl font-semibold mb-3 orders-subtitle">{title}</h2>
      <div className="overflow-x-auto card">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-900 text-gray-300">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2 font-semibold border-b border-gray-800 text-left"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data && data.length > 0 ? (
              data.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-900" : "bg-gray-800"}>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-2 border-b border-gray-800 text-gray-200"
                    >
                      {getNestedValue(item, col.key)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-4 text-gray-500"
                >
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* --- Helper functions --- */

function getNestedValue(obj, keyPath) {
  return keyPath.split(".").reduce((acc, key) => acc && acc[key], obj) || "-";
}

function formatCurrency(n) {
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(n) || 0);
  } catch {
    return `${n}`;
  }
}
