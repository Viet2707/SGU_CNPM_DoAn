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
      const errorMessage = err.response?.data?.error || "Login failed";
      const lockReason = err.response?.data?.lockReason;
      
      // Translate error messages to Vietnamese
      let vietnameseError = errorMessage;
      if (errorMessage.includes("Tài khoản đã bị khóa") || errorMessage.includes("Account is locked")) {
        vietnameseError = `🔒 Tài khoản của bạn đã bị khóa.\n\nLý do: ${lockReason || "Không có lý do cụ thể"}\n\nVui lòng liên hệ admin để được hỗ trợ.`;
      } else if (errorMessage.includes("User not found")) {
        vietnameseError = "Tài khoản không tồn tại";
      } else if (errorMessage.includes("Invalid password")) {
        vietnameseError = "Mật khẩu không đúng";
      } else {
        vietnameseError = "Đăng nhập thất bại. Vui lòng thử lại.";
      }
      
      setError(vietnameseError);
      toast.error(vietnameseError);
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

        {/* Error Message */}
        {error && (
          <div className="w-full mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <p className="font-semibold">⚠️ {error}</p>
          </div>
        )}

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label className="block text-xl font-semibold text-black mb-2">
              What's your email?
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
      </div>
    </div>
  );
}
