const { createProxyMiddleware } = require('http-proxy-middleware');

function makeProxy(target, opts = {}) {
  const timeout = parseInt(process.env.PROXY_TIMEOUT || '8000', 10);
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    proxyTimeout: timeout,
    onProxyReq: (proxyReq, req) => {
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }
    },
    ...opts
  });
}

function mountRoutes(app, mw) {
  app.use('/auth', mw.authLimiter, makeProxy(process.env.AUTH_SERVICE_URL));
  app.use(['/restaurant', '/restaurants'], mw.publicLimiter,
    makeProxy(process.env.RESTAURANT_SERVICE_URL));
  app.use(['/order', '/orders'], mw.requireAuth, makeProxy(process.env.ORDER_SERVICE_URL));
  app.use('/delivery', mw.requireAuth, makeProxy(process.env.DELIVERY_SERVICE_URL));
  app.use('/payment', mw.requireAuth, makeProxy(process.env.PAYMENT_SERVICE_URL));
}

module.exports = { mountRoutes };
