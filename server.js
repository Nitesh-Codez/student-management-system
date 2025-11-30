const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const feesRoutes = require("./routes/feesRoutes"); 
const homeworkRoutes = require("./routes/homeworkRoutes");
const studentProfileRoutes = require("./routes/studentProfileRoutes");
const db = require("./db");

const app = express();

// Middleware
app.use(cors());

// Increase JSON and URL-encoded payload limit to allow large profile uploads (like images)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Test root route
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/fees", feesRoutes);
app.use("/api/homework", homeworkRoutes);
app.use("/api/student-profile", studentProfileRoutes);

// 404 handler (last)
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
