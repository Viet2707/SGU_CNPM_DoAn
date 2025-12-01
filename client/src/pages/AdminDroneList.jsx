import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/theme.css";

const API_BASE = "http://localhost:8000"; // API Gateway

export default function AdminDroneList() {
  const [drones, setDrones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState("create"); // "create" | "edit"
  const [editingId, setEditingId] = useState(null);

  const emptyForm = {
    code: "",
    name: "",
    capacityKg: 5,
    baseLat: "",
    baseLng: "",
    baseAddress: "",
    isActive: true,
  };
  const [form, setForm] = useState(emptyForm);

  const token = localStorage.getItem("token");

  const axiosInstance = axios.create({
    baseURL: API_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const fetchDrones = async () => {
    try {
      setLoading(true);
      // Giả sử gateway map:  /drone/admin/drones  ->  drone-service /admin/drones
      const res = await axiosInstance.get("/drone/admin/drones");
      const dronesData = res.data || [];

      // Với mỗi drone, lấy tổng số đơn đã delivered do drone đó giao
      try {
        const counts = await Promise.all(
          dronesData.map((d) =>
            axiosInstance
              .get(`/admin/drone/${d._id}/delivered-count`)
              .then((r) => r.data.delivered)
              .catch(() => 0)
          )
        );

        const merged = dronesData.map((d, i) => ({
          ...d,
          deliveredCount: counts[i] || 0,
        }));

        setDrones(merged);
      } catch (e) {
        // Nếu lỗi khi fetch counts, vẫn set drones mà không có count
        console.warn("Failed to fetch delivered counts", e.message);
        setDrones(dronesData);
      }
    } catch (err) {
      console.error("Fetch drones error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrones();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      code: form.code,
      name: form.name,
      capacityKg: Number(form.capacityKg) || 5,
      isActive: form.isActive,
      baseLocation: {
        latitude: form.baseLat ? Number(form.baseLat) : undefined,
        longitude: form.baseLng ? Number(form.baseLng) : undefined,
        address: form.baseAddress || undefined,
      },
    };

    try {
      if (formMode === "create") {
        await axiosInstance.post("/drone/admin/drones", payload);
      } else {
        await axiosInstance.put(`/drone/admin/drones/${editingId}`, payload);
      }
      setForm(emptyForm);
      setFormMode("create");
      setEditingId(null);
      await fetchDrones();
    } catch (err) {
      console.error("Save drone error:", err);
    }
  };

  const handleEdit = (drone) => {
    setFormMode("edit");
    setEditingId(drone._id);
    setForm({
      code: drone.code || "",
      name: drone.name || "",
      capacityKg: drone.capacityKg || 5,
      baseLat: drone.baseLocation?.latitude ?? "",
      baseLng: drone.baseLocation?.longitude ?? "",
      baseAddress: drone.baseLocation?.address ?? "",
      isActive: drone.isActive ?? true,
    });
  };

  const handleDisable = async (id) => {
    if (!window.confirm("Disable this drone?")) return;
    try {
      await axiosInstance.patch(`/drone/admin/drones/${id}/disable`);
      await fetchDrones();
    } catch (err) {
      console.error("Disable drone error:", err);
      alert("Failed to disable drone");
    }
  };

  const handleDelete = async (id, droneName) => {
    if (!window.confirm(`Bạn có chắc muốn XÓA VĨNH VIỄN drone "${droneName}"?\n\nHành động này không thể hoàn tác!`)) {
      return;
    }

    try {
      await axiosInstance.delete(`/drone/admin/drones/${id}`);
      alert("Xóa drone thành công!");
      await fetchDrones();
    } catch (err) {
      console.error("Delete drone error:", err);
      const message = err.response?.data?.message || "Không thể xóa drone";
      alert(message);
    }
  };

  return (
    <div className="app-root py-8">
      <div className="container mx-auto">
        <h1 className="orders-title">Drone Management</h1>

        {/* Form tạo / sửa */}
        <section className="card mb-6 mt-4">
          <h2 className="orders-subtitle mb-4">
            {formMode === "create" ? "Create Drone" : "Edit Drone"}
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-sm text-gray-300 mb-1">Code</label>
              <input
                name="code"
                value={form.code}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-700"
                placeholder="DRN-001"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-700"
                placeholder="Kitchen Drone #1"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">
                Capacity (kg)
              </label>
              <input
                type="number"
                name="capacityKg"
                min="1"
                value={form.capacityKg}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-700"
              />
            </div>

            <div className="flex items-center mt-6">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={handleChange}
                className="mr-2"
              />
              <span className="text-sm text-gray-300">Active</span>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">
                Base Latitude
              </label>
              <input
                name="baseLat"
                value={form.baseLat}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">
                Base Longitude
              </label>
              <input
                name="baseLng"
                value={form.baseLng}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-gray-300 mb-1">
                Base Address
              </label>
              <input
                name="baseAddress"
                value={form.baseAddress}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-700"
                placeholder="123 Main St, HCMC"
              />
            </div>

            <div className="md:col-span-2 flex justify-end space-x-2 mt-2">
              {formMode === "edit" && (
                <button
                  type="button"
                  onClick={() => {
                    setForm(emptyForm);
                    setFormMode("create");
                    setEditingId(null);
                  }}
                  className="px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-600"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 rounded bg-yellow-500 text-black font-semibold hover:bg-yellow-400"
              >
                {formMode === "create" ? "Create" : "Update"}
              </button>
            </div>
          </form>
        </section>

        {/* Bảng danh sách drone */}
        <section className="card">
          <h2 className="orders-subtitle mb-3">Drone List</h2>
          {loading ? (
            <div className="text-gray-300">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-900 text-gray-300">
                  <tr>
                    <th className="px-4 py-2 border-b border-gray-800 text-left">
                      Code
                    </th>
                    <th className="px-4 py-2 border-b border-gray-800 text-left">
                      Name
                    </th>
                    <th className="px-4 py-2 border-b border-gray-800 text-left">
                      Status
                    </th>
                    <th className="px-4 py-2 border-b border-gray-800 text-left">
                      Capacity
                    </th>
                    <th className="px-4 py-2 border-b border-gray-800 text-left">
                      Active
                    </th>
                    <th className="px-4 py-2 border-b border-gray-800 text-left">
                      Delivered
                    </th>
                    <th className="px-4 py-2 border-b border-gray-800 text-left">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {drones.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-4 text-gray-500"
                      >
                        No drones yet.
                      </td>
                    </tr>
                  ) : (
                    drones.map((d) => (
                      <tr key={d._id} className="bg-gray-900">
                        <td className="px-4 py-2 border-b border-gray-800">
                          {d.code}
                        </td>
                        <td className="px-4 py-2 border-b border-gray-800">
                          {d.name}
                        </td>
                        <td className="px-4 py-2 border-b border-gray-800">
                          {d.status || "-"}
                        </td>
                        <td className="px-4 py-2 border-b border-gray-800">
                          {d.capacityKg} kg
                        </td>
                        <td className="px-4 py-2 border-b border-gray-800">
                          {d.isActive ? "Yes" : "No"}
                        </td>
                        <td className="px-4 py-2 border-b border-gray-800">
                          {typeof d.deliveredCount === "number"
                            ? d.deliveredCount
                            : "-"}
                        </td>
                        <td className="px-4 py-2 border-b border-gray-800 space-x-2">
                          <button
                            onClick={() => handleEdit(d)}
                            className="px-3 py-1 rounded bg-blue-500 text-white text-xs hover:bg-blue-400"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDisable(d._id)}
                            className="px-3 py-1 rounded bg-yellow-600 text-white text-xs hover:bg-yellow-500"
                          >
                            Disable
                          </button>
                          <button
                            onClick={() => handleDelete(d._id, d.name)}
                            className="px-3 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-500"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
