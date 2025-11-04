// src/pages/Login.jsx
import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" }); // Changed from username/password to single identifier
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
      const res = await axios.post("http://localhost:8000/auth/login", form);
      const { token, role } = res.data;
      localStorage.setItem("token", token);
      const user = { role: role };
      localStorage.setItem("user", JSON.stringify(user));
      toast.success(`Welcome ${role}`);
      if (role === "admin") {
        window.location.href = "/admin/dashboard";
      } else if (role === "customer") {
        window.location.href = "/home";
      } else if (role === "restaurant") {
        window.location.href = "/restaurant/orders";
      } else if (role === "delivery") {
        window.location.href = "/delivery/orders/all";
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4 px-6">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black">Login</h1>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label className="block text-xl font-semibold text-black mb-2">
              What's your user name or email?
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
          </div>

          <div>
            <label className="block text-xl font-semibold text-black mb-2">
              What's your password?
            </label>
            <input
              type="password"
              name="password"
              value={form.password || ""}
              onChange={handleChange}
              placeholder="Enter your password"
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 placeholder-gray-400"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-lg font-semibold transition"
            disabled={loading}
          >
            {loading ? "Continuing..." : "Continue"}
          </button>
        </form>

        {/* Terms Text */}
        <p className="text-xs text-gray-500 text-center mt-6">
          By proceeding, you consent to get calls, WhatsApp or SMS/RCS messages,
          including by automated means, from Uber and its affiliates to the
          number provided.
        </p>
      </div>
    </div>
  );
}
