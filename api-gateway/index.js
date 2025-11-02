require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const { publicLimiter, authLimiter } = require('./middleware/rateLimit');
const { requireAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');
const { mountRoutes } = require('./routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(compression());
app.use(morgan('dev'));

const mw = { publicLimiter, authLimiter, requireAuth };

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

mountRoutes(app, mw);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 API Gateway running on port ${PORT}`));
