require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const { mountRoutes } = require('./routes'); // proxy routes

const app = express();

// KHÔNG app.use(express.json()) ở đây để tránh nuốt stream trước proxy
app.use(helmet());
app.use(cors({ origin: ['http://localhost:3000'], credentials: true }));
app.use(compression());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ status: 'ok', gateway: true }));

mountRoutes(app);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 API Gateway running on port ${PORT}`));
