import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

export default function Register() {
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "customer",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:8000/auth/register", form);
      toast.success(res.data.message);
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black">Register</h1>
        </div>

        {/* Form Section */}
        <div className="w-full space-y-4">
          <label className="block text-xl font-semibold text-black mb-2">
            Create an account
          </label>
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            placeholder="Enter phone number or email"
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 placeholder-gray-400"
            required
          />
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter password"
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 placeholder-gray-400"
            required
          />
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
            required
          >
            <option value="customer">Customer</option>
            <option value="restaurant">Restaurant</option>
            <option value="delivery">Delivery</option>
            {/* <option value="admin">Admin</option> */}
          </select>

          <button
            onClick={handleSubmit}
            className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-lg font-semibold transition"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Continue"}
          </button>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
}
