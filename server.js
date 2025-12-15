const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const feesRoutes = require("./routes/feesRoutes");
const homeworkRoutes = require("./routes/homeworkRoutes");
const studentProfileRoute = require("./routes/studentProfileRoute");
const marksRoutes = require("./routes/marksRoutes");
const studyMaterialRoutes = ("./routes/studyMaterialRoutes.");
const newMarksRoutes = require("./routes/newMarksRoutes");



const db = require("./db"); 

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => res.send("Server is running!"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/fees", feesRoutes);
app.use("/api/homework", homeworkRoutes);
app.use("/api/marks", marksRoutes);
app.use("/api/study-material", studyMaterialRoutes);
app.use("/api/marks", newMarksRoutes);




// **IMPORTANT**
app.use("/api/student-profile", studentProfileRoute);


// 404
app.use((req, res) =>
  res.status(404).json({ success: false, message: "Route not found" })
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));