const express = require("express");
const router = express.Router();

// ✅ Single controller import (clean & safe)
const attendanceController = require("../controllers/attendanceController");

// ------------------------------------
// GET students list for a specific date (Admin)
// ------------------------------------
router.get("/list", attendanceController.getStudentsList);

// ------------------------------------
// POST mark or update attendance (Admin)
// ------------------------------------
router.post("/mark", attendanceController.markAttendance);

// ------------------------------------
// GET full attendance of a student (Student)
// ------------------------------------
router.get("/:id", attendanceController.getStudentAttendance);

// ------------------------------------
// GET today attendance percentage (Admin)
// ------------------------------------
router.get(
  "/today-percent",
  attendanceController.getTodayAttendancePercent
);

// ------------------------------------
// ✅ GET attendance marks (MONTHLY)
// ------------------------------------
router.get(
  "/attendance-marks",
  attendanceController.getAttendanceMarks
);

module.exports = router;
