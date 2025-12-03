import { useEffect, useState } from "react";
import axios from "axios";
import '../styles/theme.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("stats"); // "stats" or "accounts"
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);

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

  useEffect(() => {
    if (activeTab === "accounts") {
      fetchCustomers();
      fetchRestaurants();
    }
  }, [activeTab]);

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:8000/auth/admin/customers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(res.data);
    } catch (err) {
      console.error("Failed to fetch customers:", err);
      alert("Không thể tải danh sách khách hàng");
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchRestaurants = async () => {
    setLoadingRestaurants(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:8000/restaurant/api/restaurants", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRestaurants(res.data);
    } catch (err) {
      console.error("Failed to fetch restaurants:", err);
      alert("Không thể tải danh sách nhà hàng");
    } finally {
      setLoadingRestaurants(false);
    }
  };

  const handleDeleteCustomer = async (customerId, username) => {
    if (!window.confirm(`Bạn có chắc muốn xóa tài khoản "${username}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:8000/auth/admin/customers/${customerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Xóa tài khoản thành công!");
      fetchCustomers(); // Refresh list
    } catch (err) {
      console.error("Failed to delete customer:", err);
      const message = err.response?.data?.message || "Không thể xóa tài khoản";
      alert(message);
    }
  };

  const handleDeleteRestaurant = async (restaurantId, restaurantName) => {
    if (!window.confirm(`Bạn có chắc muốn XÓA VĨNH VIỄN nhà hàng "${restaurantName}"?\n\nHành động này sẽ xóa:\n- Nhà hàng\n- Tất cả menu items\n- Tài khoản owner\n\nHành động này không thể hoàn tác!`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:8000/restaurant/admin/restaurants/${restaurantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Xóa nhà hàng thành công!");
      fetchRestaurants(); // Refresh list
    } catch (err) {
      console.error("Failed to delete restaurant:", err);
      const message = err.response?.data?.message || "Không thể xóa nhà hàng";
      alert(message);
    }
  };

  if (loading) return <div className="p-6 text-white text-lg">Loading dashboard...</div>;

  return (
    <div className="app-root py-8">
      <div className="container mx-auto">
        <h1 className="orders-title">Admin Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-700">
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === "stats"
                ? "text-green-400 border-b-2 border-green-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            📊 Thống kê
          </button>
          <button
            onClick={() => setActiveTab("accounts")}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === "accounts"
                ? "text-green-400 border-b-2 border-green-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            👥 Quản lý tài khoản
          </button>
        </div>

        {/* Stats Tab */}
        {activeTab === "stats" && stats && <StatsView stats={stats} />}

        {/* Accounts Tab */}
        {activeTab === "accounts" && (
          <>
            <AccountsView
              customers={customers}
              loading={loadingCustomers}
              onDelete={handleDeleteCustomer}
            />
            <RestaurantsView
              restaurants={restaurants}
              loading={loadingRestaurants}
              onDelete={handleDeleteRestaurant}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* --- Stats View Component --- */
function StatsView({ stats }) {
  const {
    totalOrders,
    totalRevenue,
    restaurantAgg: restaurantBreakdown,
    deliveryAgg: deliveryBreakdown,
    customerAgg: customerBreakdown,
  } = stats;

  return (
    <>
      <div className="container mx-auto">

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
    </>
  );
}

/* --- Accounts View Component --- */
function AccountsView({ customers, loading, onDelete }) {
  if (loading) {
    return <div className="text-white text-lg">Đang tải danh sách khách hàng...</div>;
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-3 orders-subtitle">👥 Danh sách khách hàng</h2>
      <div className="overflow-x-auto card">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-900 text-gray-300">
            <tr>
              <th className="px-4 py-2 font-semibold border-b border-gray-800 text-left">Username</th>
              <th className="px-4 py-2 font-semibold border-b border-gray-800 text-left">Email</th>
              <th className="px-4 py-2 font-semibold border-b border-gray-800 text-left">Verified</th>
              <th className="px-4 py-2 font-semibold border-b border-gray-800 text-left">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {customers && customers.length > 0 ? (
              customers.map((customer, i) => (
                <tr key={customer._id} className={i % 2 === 0 ? "bg-gray-900" : "bg-gray-800"}>
                  <td className="px-4 py-2 border-b border-gray-800 text-gray-200">
                    {customer.username}
                  </td>
                  <td className="px-4 py-2 border-b border-gray-800 text-gray-200">
                    {customer.email || "-"}
                  </td>
                  <td className="px-4 py-2 border-b border-gray-800 text-gray-200">
                    {customer.verified ? "✅" : "❌"}
                  </td>
                  <td className="px-4 py-2 border-b border-gray-800">
                    <button
                      onClick={() => onDelete(customer._id, customer.username)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
                    >
                      🗑️ Xóa
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-4 text-gray-500">
                  Không có khách hàng nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* --- Restaurants View Component --- */
function RestaurantsView({ restaurants, loading, onDelete }) {
  if (loading) {
    return <div className="text-white text-lg mt-6">Đang tải danh sách nhà hàng...</div>;
  }

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold mb-3 orders-subtitle">🏪 Danh sách nhà hàng</h2>
      <div className="overflow-x-auto card">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-900 text-gray-300">
            <tr>
              <th className="px-4 py-2 font-semibold border-b border-gray-800 text-left">
                Tên nhà hàng
              </th>
              <th className="px-4 py-2 font-semibold border-b border-gray-800 text-left">
                Owner ID
              </th>
              <th className="px-4 py-2 font-semibold border-b border-gray-800 text-left">
                Trạng thái
              </th>
              <th className="px-4 py-2 font-semibold border-b border-gray-800 text-left">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody>
            {restaurants && restaurants.length > 0 ? (
              restaurants.map((restaurant, i) => (
                <tr key={restaurant._id} className={i % 2 === 0 ? "bg-gray-900" : "bg-gray-800"}>
                  <td className="px-4 py-2 border-b border-gray-800 text-gray-200">
                    {restaurant.name}
                  </td>
                  <td className="px-4 py-2 border-b border-gray-800 text-gray-200">
                    {restaurant.ownerId}
                  </td>
                  <td className="px-4 py-2 border-b border-gray-800 text-gray-200">
                    {restaurant.isOpen ? "🟢 Đang mở" : "🔴 Đã đóng"}
                  </td>
                  <td className="px-4 py-2 border-b border-gray-800">
                    <button
                      onClick={() => onDelete(restaurant._id, restaurant.name)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
                    >
                      🗑️ Xóa
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-4 text-gray-500">
                  Chưa có nhà hàng nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* --- Components --- */

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
