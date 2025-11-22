const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes"); // login ke liye
const db = require("./db"); // DB connection

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Root route for browser test
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// Test route for DB connection
app.get("/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1+1 AS result");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login route
app.use("/api/auth", authRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
