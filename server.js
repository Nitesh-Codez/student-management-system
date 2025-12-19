const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
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

// Upload student photo route
const uploadStudentPhoto = require("./routes/uploadStudentPhoto"); // ✅ Correct export needed

// Database (if any)
const db = require("./db");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get("/", (req, res) => res.send("Server is running!"));

// ================================
// FILE UPLOAD SETUP (if not in separate route)
const uploadDir = path.join(__dirname, "private_uploads/students");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const studentId = req.body.studentId;
    const ext = path.extname(file.originalname);
    cb(null, `${studentId}${ext}`);
  },
});
const upload = multer({ storage });
// ================================

// ================================
// Routes
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


// Serve static files (uploaded photos)
app.use("/private_uploads", express.static(path.join(__dirname, "private_uploads")));

// 404 handler
app.use((req, res) =>
  res.status(404).json({ success: false, message: "Route not found" })
);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
