const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const feesRoutes = require("./routes/feesRoutes"); 
const homeworkRoutes = require("./routes/homeworkRoutes");
const studentProfileRoutes = require("./routes/studentProfileRoutes");
const db = require("./db"); // MySQL connection

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // body parser for JSON
app.use(express.urlencoded({ extended: true }));

// Root route (test)
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

/**
 * 404 handler
 * This should always be last, to catch any undefined routes
 */
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
