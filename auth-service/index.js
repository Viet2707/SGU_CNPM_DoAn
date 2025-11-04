require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json()); // parse JSON ở service
app.use(compression());
app.use(morgan('dev'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Auth DB connected'))
  .catch(err => console.error('Mongo Error:', err));

const authRoutes = require('./routes/auth'); // định nghĩa /login, /register
const adminRoutes = require('./routes/admin');

app.use('/', authRoutes);     // <-- quan trọng: mount tại "/"
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`));
