function notFound(_req, res) {
  res.status(404).json({ message: 'Gateway: route not found' });
}

function errorHandler(err, _req, res, _next) {
  console.error('Gateway error:', err);
  res.status(502).json({ message: 'Upstream error', detail: err.message || String(err) });
}

module.exports = { notFound, errorHandler };
