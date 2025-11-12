const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));

// Debug: log incoming requests and whether an Authorization header exists.
// This helps diagnose why some requests are being rejected before the
// admin handler runs.
app.use((req, res, next) => {
  console.log(
    `[Incoming] ${req.method} ${req.path} authHeader=${!!req.headers
      .authorization}`
  );
  next();
});

// 🧩 Import routes
const orderRoutes = require("./routes/order");
const adminRoutes = require("./routes/admin");

// 🧩 Mount routes
app.use("/", orderRoutes); // ✨ thêm dòng này
app.use("/admin", adminRoutes);

// DB connect
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Order DB connected"))
  .catch((err) => console.error("Order DB error:", err.message));

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => console.log(`Order Service running on port ${PORT}`));
