const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const feesRoutes = require("./routes/feesRoutes");
const homeworkRoutes = require("./routes/homeworkRoutes");
const studentProfileRoute = require("./routes/studentProfileRoute");
const marksRoutes = require("./routes/marksRoutes");
const studyMaterialRoutes = require("./routes/studyMaterialRoutes");
const newMarksRoutes = require("./routes/newMarksRoutes");
const uploadStudentPhoto = require("./routes/uploadStudentPhoto");

// Initialize DB (connection only)
require("./db");

const app = express();

// ================= MIDDLEWARES =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= TEST ROUTE ==================
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// ================= ROUTES ======================
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/fees", feesRoutes);
app.use("/api/homework", homeworkRoutes);
app.use("/api/marks", marksRoutes);
app.use("/api/study-material", studyMaterialRoutes);
app.use("/api/new-marks", newMarksRoutes);
app.use("/api/student-profile", studentProfileRoute);
app.use("/api/upload", uploadStudentPhoto);

// ============ STATIC FILES (UPLOADS) ============
app.use(
  "/private_uploads",
  express.static(path.join(__dirname, "private_uploads"))
);

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// ================= 404 HANDLER =================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ================= SERVER START =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
