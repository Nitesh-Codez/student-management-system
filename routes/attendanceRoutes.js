const express = require("express");
const router = express.Router();
const {
  markAttendance,
  getAttendanceByDate,
  getAttendanceByStudent,
  getAllAttendance
} = require("../controllers/attendanceController");

// Admin: all students attendance %
router.get("/all", getAllAttendance);

// GET attendance by date
router.get("/", getAttendanceByDate);

// GET attendance by student ID
router.get("/:id", getAttendanceByStudent);

// POST: mark attendance
router.post("/", markAttendance);

module.exports = router;
