const express = require("express");
const router = express.Router();
const {
  markAttendance,
  getAttendanceByDate,
  getAttendanceByStudent,
  getAllAttendance
} = require("../controllers/attendanceController");

// GET all students attendance with percentage (admin)
router.get("/all", getAllAttendance);

// GET attendance by date (optional ?class=10TH)
router.get("/", getAttendanceByDate);

// GET attendance by student ID
router.get("/:id", getAttendanceByStudent);

// POST: mark attendance
router.post("/", markAttendance);

module.exports = router;
