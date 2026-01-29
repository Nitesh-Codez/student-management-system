const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// 1. Chat Route Import karo
const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const feesRoutes = require("./routes/feesRoutes");
const marksRoutes = require("./routes/marksRoutes");
const studyMaterialRoutes = require("./routes/studyMaterialRoutes");
const newMarksRoutes = require("./routes/newMarksRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const chatRoutes = require("./routes/chatRoutes"); // <--- YE ADD KIYA
const studentsProfileRoute = require("./routes/studentsProfileRoute");

// DB init
require("./db");

const app = express();

// ============ MIDDLEWARE ============
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============ TEST ============
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// ============ ROUTES ============
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/fees", feesRoutes);
app.use("/api/marks", marksRoutes);
app.use("/api/study-material", studyMaterialRoutes);
app.use("/api/new-marks", newMarksRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/chat", chatRoutes); // <--- YE SABSE ZAROORI HAI
app.use("/api/students", studentsProfileRoute);

// ============ STATIC (Images dikhane ke liye) ============
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/private_uploads", express.static(path.join(__dirname, "private_uploads")));

// ============ 404 ============
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ============ START ============
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});