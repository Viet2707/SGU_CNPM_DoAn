import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const RestaurantSettings = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchRestaurantStatus();
  }, []);

  const fetchRestaurantStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:8000/restaurant/my-status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(response.data);
    } catch (err) {
      console.error('Error fetching restaurant status:', err);
      toast.error('Không thể tải thông tin nhà hàng');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleClosure = async () => {
    const newClosureState = !status.isTemporarilyClosed;
    
    // Chỉ cần confirm, không cần nhập lý do
    const action = newClosureState ? 'đóng cửa' : 'mở cửa';
    if (!window.confirm(`Bạn có chắc muốn ${action} nhà hàng?`)) {
      return;
    }

    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        'http://localhost:8000/restaurant/toggle-closure',
        { 
          isTemporarilyClosed: newClosureState,
          reason: newClosureState ? 'Tạm thời đóng cửa' : null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Nhà hàng đã ${action} thành công!`);
      fetchRestaurantStatus(); // Refresh status
    } catch (err) {
      console.error('Error toggling closure:', err);
      const message = err.response?.data?.message || 'Không thể thay đổi trạng thái';
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  };

  const handleRequestPermanentClosure = async () => {
    const reason = window.prompt(
      "⚠️ YÊU CẦU ĐÓNG TÀI KHOẢN VĨNH VIỄN\n\n" +
      "Hành động này sẽ gửi yêu cầu đến admin để xem xét.\n" +
      "Nếu được chấp thuận, tài khoản sẽ bị xóa vĩnh viễn.\n\n" +
      "Nhập lý do yêu cầu đóng tài khoản:"
    );
    
    if (reason === null) return; // User cancelled
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do!");
      return;
    }

    if (!window.confirm(
      "Bạn có CHẮC CHẮN muốn yêu cầu đóng tài khoản vĩnh viễn?\n\n" +
      "Hành động này không thể hoàn tác nếu admin chấp thuận!"
    )) {
      return;
    }

    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:8000/restaurant/request-permanent-closure',
        { reason: reason.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Yêu cầu đã được gửi. Admin sẽ xem xét trong thời gian sớm nhất.");
      fetchRestaurantStatus(); // Refresh status
    } catch (err) {
      console.error('Error requesting permanent closure:', err);
      const message = err.response?.data?.message || 'Không thể gửi yêu cầu';
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8">
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full border-4 border-yellow-500 border-t-transparent animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="py-8">
        <div className="bg-red-500 text-white p-4 rounded">
          Không thể tải thông tin nhà hàng
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold mb-8">Cài đặt nhà hàng</h1>

      {/* Restaurant Info */}
      <div className="bg-gray-900 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Thông tin nhà hàng</h2>
        <div className="space-y-2">
          <p><span className="text-gray-400">Tên:</span> <span className="font-semibold">{status.name}</span></p>
          <p><span className="text-gray-400">ID:</span> <span className="text-sm">{status.restaurantId}</span></p>
        </div>
      </div>

      {/* Account Status */}
      <div className="bg-gray-900 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Trạng thái tài khoản</h2>
        
        {status.isLocked ? (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🔒</span>
              <span className="font-bold text-red-400">Tài khoản đã bị khóa bởi Admin</span>
            </div>
            <p className="text-gray-300">
              <span className="font-semibold">Lý do:</span> {status.lockReason || "Không có lý do cụ thể"}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Vui lòng liên hệ admin để được hỗ trợ.
            </p>
          </div>
        ) : (
          <div className="bg-green-900 border border-green-700 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              <span className="font-bold text-green-400">Tài khoản đang hoạt động bình thường</span>
            </div>
          </div>
        )}
      </div>

      {/* Temporary Closure */}
      <div className="bg-gray-900 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Trạng thái nhà hàng</h2>
        <p className="text-gray-400 mb-4">
          Bạn có thể đóng cửa hoặc mở cửa nhà hàng bất cứ lúc nào. 
          Khách hàng sẽ không thấy menu của bạn khi nhà hàng đóng cửa.
        </p>

        {/* Current Status Display */}
        <div className={`rounded-lg p-4 mb-4 ${
          status.isTemporarilyClosed 
            ? 'bg-red-900 border border-red-700' 
            : 'bg-green-900 border border-green-700'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{status.isTemporarilyClosed ? '🔒' : '🔓'}</span>
            <div>
              <span className={`font-bold block ${
                status.isTemporarilyClosed ? 'text-red-400' : 'text-green-400'
              }`}>
                {status.isTemporarilyClosed ? 'Nhà hàng đang đóng cửa' : 'Nhà hàng đang mở cửa'}
              </span>
              <p className="text-gray-300 text-sm mt-1">
                {status.isTemporarilyClosed 
                  ? 'Khách hàng không thể xem menu của bạn'
                  : 'Khách hàng có thể xem menu và đặt món'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={handleToggleClosure}
          disabled={updating || status.isLocked}
          className={`w-full py-3 rounded-lg font-semibold transition ${
            status.isTemporarilyClosed
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          } ${(updating || status.isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {updating ? 'Đang xử lý...' : (
            status.isTemporarilyClosed ? '🔓 Mở cửa' : '🔒 Đóng cửa'
          )}
        </button>
        
        {status.isLocked && (
          <p className="text-sm text-gray-500 mt-2 text-center">
            Không thể thay đổi trạng thái khi tài khoản đang bị khóa
          </p>
        )}
      </div>

      {/* Permanent Closure Request */}
      <div className="bg-gray-900 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-red-400">Đóng tài khoản vĩnh viễn</h2>
        <p className="text-gray-400 mb-4">
          Nếu bạn muốn đóng tài khoản vĩnh viễn, vui lòng gửi yêu cầu đến admin. 
          Admin sẽ xem xét và xử lý yêu cầu của bạn.
        </p>

        {status.hasPendingClosureRequest && (
          <div className="bg-orange-900 border border-orange-700 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">⏳</span>
              <span className="font-bold text-orange-400">Yêu cầu đang chờ xử lý</span>
            </div>
            <p className="text-gray-300 text-sm">
              <span className="font-semibold">Lý do:</span> {status.pendingClosureRequest?.reason}
            </p>
            <p className="text-gray-400 text-xs mt-2">
              Gửi lúc: {new Date(status.pendingClosureRequest?.requestedAt).toLocaleString('vi-VN')}
            </p>
          </div>
        )}

        <button
          onClick={handleRequestPermanentClosure}
          disabled={updating || status.isLocked || status.hasPendingClosureRequest}
          className={`w-full py-3 rounded-lg font-semibold transition bg-red-600 hover:bg-red-700 text-white ${
            (updating || status.isLocked || status.hasPendingClosureRequest) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {status.hasPendingClosureRequest 
            ? '⏳ Yêu cầu đang chờ xử lý' 
            : '🗑️ Yêu cầu đóng tài khoản vĩnh viễn'}
        </button>

        {status.isLocked && (
          <p className="text-sm text-gray-500 mt-2 text-center">
            Không thể gửi yêu cầu khi tài khoản đang bị khóa
          </p>
        )}
      </div>
    </div>
  );
};

export default RestaurantSettings;
