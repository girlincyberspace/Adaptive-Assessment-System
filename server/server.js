const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const mongoose = require("mongoose"); // <-- add mongoose
require("dotenv").config();

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173", // Vite default port
    credentials: true,
  })
);
app.use(express.json());

// ===== MongoDB Connection =====
mongoose
  .connect("mongodb://127.0.0.1:27017/adaptive-assessment", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Import routes
const assessmentRoutes = require("./routes/assessment");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");

// Use routes
app.use("/api/assessment", assessmentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);

// Serve static files from React app in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
