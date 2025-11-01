const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

(async () => {
  try {
    await mongoose.connect("mongodb+srv://vietnx2707_db_user:123@cluster0.1ijcrzp.mongodb.net/authdb?retryWrites=true&w=majority");

    const existing = await User.findOne({ username: "admin" });
    if (existing) {
      console.log("⚠️ Admin already exists!");
      process.exit(0);
    }

    const hashed = await bcrypt.hash("admin123", 10);
    await User.create({
      username: "admin",
      email: "admin@fastfood.com",
      password: hashed,
      role: "admin"
    });

    console.log("✅ Admin user created successfully!");
  } catch (err) {
    console.error("❌ Seed error:", err);
  } finally {
    process.exit(0);
  }
})();
