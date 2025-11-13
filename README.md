📘 FoodFast – Microservices Food Ordering System

Đồ án Công nghệ phần mềm – SGU

🧩 1. Giới thiệu hệ thống

FoodFast là hệ thống đặt món ăn – giao hàng được xây dựng theo kiến trúc Microservices, nhằm mô phỏng hoạt động của một nền tảng đặt đồ ăn trực tuyến (tương tự GrabFood, Baemin, ShopeeFood).
Hệ thống gồm các phân hệ lớn:

- Người dùng chọn món, thêm vào giỏ hàng, đặt đơn
- Nhà hàng quản lý menu, đơn hàng
- Tài xế giao nhận
- Hệ thống thanh toán Stripe
- API Gateway chịu trách nhiệm điều phối

Kiến trúc microservices giúp:

- Dễ mở rộng (scalability)
- Dễ bảo trì (maintenance)
- Độc lập triển khai từng service
- Giảm coupling giữa các thành phần

🏗 2. Kiến trúc tổng thể hệ thống

```text
Client (React)
     │
     ▼
API Gateway (8000)
├── Auth-Service (5001)
├── Restaurant-Service (5002)
├── Order-Service (5003)
├── Delivery-Service (5004)
├── Payment-Service (5008)
└── External API (Stripe)
     │
     ▼
MongoDB Atlas (authdb, restaurantdb, orderdb, paymentdb)
Cloudinary API (media)
Stripe API (payment)
```

Hệ thống tuân theo nguyên tắc Database-per-service:
→ mỗi service có database độc lập, không chia sẻ schema.

🧩 3. Danh sách Microservices

3.1. API Gateway

- Cổng vào duy nhất của mọi client.
- Xử lý:

* Proxy request → các service
* JWT Authentication
* Role-based routing
* Path rewrite

- Port: 8000

  3.2. Auth-Service - 5001

- Đăng ký, đăng nhập, refresh-token
- Quản lý user (Customer, Restaurant Owner, Admin, Delivery Person)
- JWT + Bcrypt
- Database: authdb-mongo

  3.3. Restaurant-Service - 5002

- Quản lý:

* Nhà hàng
* Menu
* Hình ảnh món ăn

- Cho phép admin và restaurant owner thêm/sửa/xoá
- Database: restaurantdb

  3.4. Order-Service - 5003

- Xử lý:

* Tạo đơn hàng
* Tính tổng tiền
* Update trạng thái
* Gán delivery person

- Đồng bộ với Payment-Service khi thanh toán thành công
- Database: orderdb

  3.5. Delivery-Service - 5004

- Quản lý shipper
- Nhận đơn → xác nhận giao
- Cập nhật trạng thái giao hàng
- Database: deliverydb

  3.6. Payment-Service - 5008

- Tích hợp Stripe SDK
- Chức năng:

* Tạo Stripe Customer
* Tạo Payment Intent
* Kiểm tra thanh toán đã thành công
* Gửi kết quả về Order-Service

- Database: paymentdb

🔄 4. Operational Flow – Luồng hoạt động tổng thể
Dựa trên source code client + backend:

1. Customer duyệt danh sách nhà hàng
   Client → API Gateway → Restaurant-Service
   → trả về danh sách menu + nhà hàng

2. Customer chọn món → thêm vào giỏ (local state của client)

3. Customer đặt món
   Client → API Gateway → Order-Service
   Order-Service:

- Tính tổng tiền
- Tạo order
- Gán trạng thái: "PENDING_PAYMENT"

4. Khởi tạo quy trình thanh toán
   Client → API Gateway → Payment-Service
   Payment-Service:

- Tạo Stripe Customer (nếu chưa có)
- Tạo Payment Intent
- Trả clientSecret về client

5. Customer thanh toán trên web
   Client dùng Stripe SDK confirm payment

6. Stripe → Payment-Service webhook

- Payment-Service xác nhận payment_intent.succeeded
- Cập nhật order:

* "PAID"
* lưu transactionId

7. Order-Service → Delivery-Service

- Giao đơn cho tài xế phù hợp

8. Delivery-Service cập nhật

- "DELIVERING"
- "COMPLETED"

💳 5. Payment Processing Flow (Stripe)
Dựa 100% vào payment-service và order-service trong repo.

1. Client yêu cầu tạo Stripe Customer
   POST /payment/customer

2. Payment-Service tạo Customer trên Stripe

3. Client tạo Payment Intent
   POST /payment/create-payment-intent

Payment-Service:

- Tạo PaymentIntent (Stripe)
- Lưu vào paymentdb
- Trả về clientSecret

4. Frontend gọi Stripe SDK
   stripe.confirmCardPayment(clientSecret)

5. Stripe gửi webhook
   payment_intent.succeeded

6. Payment-Service cập nhật Order-Service
   PATCH /order/update-payment

Order-Service:

- Cập nhật paid=true
- Trạng thái: PAID

7. Order-Service giao việc cho Delivery-Service

```text
SGU_CNPM_DoAn
│
├── api-gateway
│   ├── middleware/
│   ├── routes/        📌 (KHÔNG có controller – chỉ proxy)
│   ├── config/
│   └── index.js
│
├── auth-service
│   ├── models/
│   ├── routes/        📌 Controller
│   ├── utils/
│   ├── seedAdmin.js
│   ├── index.js
│   └── Dockerfile
│
├── restaurant-service
│   ├── models/
│   ├── routes/        📌 Controller
│   ├── utils/
│   ├── index.js
│   └── Dockerfile
│
├── order-service
│   ├── models/
│   ├── routes/        📌 Controller
│   ├── utils/
│   ├── index.js
│   └── Dockerfile
│
├── delivery-service
│   ├── routes/        📌 Controller
│   ├── utils/
│   ├── index.js
│   └── Dockerfile
│
├── payment-service
│   ├── models/
│   ├── routes/        📌 Controller
│   ├── utils/
│   ├── stripe/
│   ├── server.js
│   └── Dockerfile
│
├── client (React)
│   ├── pages/
│   ├── components/
│   ├── services/
│   ├── public/
│   └── src/
│
└── docker-compose.yml
```

🐳 7. Chạy hệ thống bằng Docker
7.1. Yêu cầu

- Docker Desktop
- NodeJS 18+
- Stripe Secret Key

  7.2. Giải nén dự án và chạy
  docker compose up -d --build

Các dịch vụ sẽ chạy tại:

- Service Port
- API Gateway 8000
- Auth 5001
- Restaurant 5002
- Order 5003
- Delivery 5004
- Payment 5008
- Client 3000
  MongoDB chạy qua image mongo trong compose.

🔐 8. API Gateway Routing
Ví dụ trong gateway:
/auth/_ → auth-service:5001
/restaurant/_ → restaurant-service:5002
/order/_ → order-service:5003
/delivery/_ → delivery-service:5004
/payment/\* → payment-service:5008

🧪 9. Kiểm thử API
Có thể dùng:
✔ Postman
✔ Thunder Client
✔ Swagger (nếu tự bổ sung)

📦 10. Công nghệ sử dụng
Thành phần Công nghệ
Backend Node.js + Express
Frontend React + Vite
DB MongoDB
Auth JWT, bcrypt
Payment Stripe
Container Docker Compose
Deployment K8s (folder k8s/)
API Routing Express + http-proxy-middleware
