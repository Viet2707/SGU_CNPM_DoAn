import React, { useEffect, useState } from "react";
import axios from "axios";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("http://localhost:8000/admin/stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStats(res.data);
      } catch (err) {
        console.error("Admin stats error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading)
    return <div className="p-6 text-black text-lg">Loading dashboard...</div>;
  if (!stats)
    return <div className="p-6 text-black text-lg">No stats available.</div>;

  const {
    totalOrders,
    totalRevenue,
    restaurantBreakdown,
    deliveryBreakdown,
    customerBreakdown,
  } = stats;

  return (
    <div className="p-6 space-y-8 text-black">
      <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>

      {/* Summary cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Orders" value={totalOrders} />
        <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} />
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
          { key: "deliveryName", label: "Delivery" },
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
          { key: "customerName", label: "Customer" },
          { key: "email", label: "Email" },
          { key: "orders", label: "Orders" },
          { key: "totalSpent", label: "Total Spent" },
        ]}
      />
    </div>
  );
}

/* --- Components --- */

function StatCard({ title, value }) {
  return (
    <div className="bg-white rounded-lg shadow p-5 border border-gray-200">
      <div className="text-gray-700 text-base">{title}</div>
      <div className="text-2xl font-bold mt-2 text-black">{value}</div>
    </div>
  );
}

function BreakdownTable({ title, data = [], columns = [] }) {
  return (
    <section>
      <h2 className="text-2xl font-semibold mb-3">{title}</h2>
      <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-gray-100 text-black">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2 font-semibold border-b border-gray-300 text-left"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data && data.length > 0 ? (
              data.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-2 border-b border-gray-200 text-black"
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
