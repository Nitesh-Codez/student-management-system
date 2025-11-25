const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes"); 
const attendanceRoutes = require("./routes/attendanceRoutes"); // ✅ Add this
const db = require("./db"); // Promise-based DB

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running!");
});

app.get("/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1+1 AS result");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes); // ✅ Mount attendance route

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
