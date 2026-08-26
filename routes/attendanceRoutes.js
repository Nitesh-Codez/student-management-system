const express = require("express");
const router = express.Router();

//Middlewares
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

// ✅ Single controller import (clean & safe)
const attendanceController = require("../controllers/attendanceController");

// ------------------------------------
// GET students list for a specific date (Admin)
router.get("/list",authMiddleware,adminMiddleware, attendanceController.getStudentsList);

// ------------------------------------
// POST mark or update attendance (Admin)
router.post("/mark",authMiddleware,adminMiddleware,attendanceController.markAttendance);

// ------------------------------------
// GET today attendance percentage (Admin)
router.get("/today-percent",authMiddleware, attendanceController.getTodayAttendancePercent);

// ------------------------------------
// ✅ GET attendance marks (MONTHLY)
router.get("/attendance-marks",authMiddleware, attendanceController.getAttendanceMarks);

// ------------------------------------
// GET full attendance of a student (Student)
router.get("/:id",authMiddleware, attendanceController.getStudentAttendance);


//--------------------------------------------------------
router.get("/admin/student-requests", attendanceController.getAllStudentRequests);
router.get("/student/:id/requests", attendanceController.getMyStudentRequests);

module.exports = router;
