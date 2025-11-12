const { createProxyMiddleware } = require("http-proxy-middleware");

function mountRoutes(app) {
  console.log("🔗 Mounting service routes...");

  app.use(
    "/auth",
    createProxyMiddleware({
      target: "http://auth-service:5001",
      changeOrigin: true,
      pathRewrite: { "^/auth": "" },
      onProxyReq: (proxyReq, req, res) => {
        // Nếu body đã parse (trường hợp nào đó), ta ghi lại
        if (req.body && Object.keys(req.body).length) {
          console.log(
            `🚀 [Gateway] Forwarding ${req.method} ${req.originalUrl} → auth-service`
          );
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader("Content-Type", "application/json");
          proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      },
      logLevel: "debug",
    })
  );
  // ✅ ADMIN stats → order-service
  app.use(
    "/admin",
    createProxyMiddleware({
      target: "http://order-service:5003",
      changeOrigin: true,
      logLevel: "debug",
      proxyTimeout: Number(process.env.PROXY_TIMEOUT) || 8000,
      timeout: Number(process.env.PROXY_TIMEOUT) || 8000,
    })
  );

  // ✅ ADMIN users/verify → auth-service
  // app.use(
  //   "/admin",
  //   createProxyMiddleware({
  //     target: "http://auth-service:5001",
  //     changeOrigin: true,
  //     pathRewrite: { "^/admin": "/admin" },
  //     logLevel: "debug",
  //   })
  // );

  app.use(
    "/restaurant",
    createProxyMiddleware({
      target: "http://restaurant-service:5002",
      changeOrigin: true,
      pathRewrite: { "^/restaurant": "" }, // hoặc '' nếu service không có tiền tố /restaurant
      logLevel: "debug",
    })
  );

  app.use(
    "/order",
    createProxyMiddleware({
      target: "http://order-service:5003",
      changeOrigin: true,
      pathRewrite: { "^/order": "" }, // ✨ Thêm dòng này
    })
  );

  app.use(
    "/delivery",
    createProxyMiddleware({
      target: "http://delivery-service:5004",
      changeOrigin: true,
      pathRewrite: { "^/delivery": "" }, // 💥 Thêm dòng này
      logLevel: "debug",
    })
  );

  // ✅ Payment Service
  app.use(
    "/payment",
    createProxyMiddleware({
      target: "http://payment-service:5008", // port payment-service chạy trong Docker
      changeOrigin: true,
      pathRewrite: { "^/payment": "" },
      logLevel: "debug",
    })
  );
}

module.exports = { mountRoutes };
