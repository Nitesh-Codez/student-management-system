const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");

// GET students list for a specific date (Admin)
router.get("/list", attendanceController.getStudentsList);

// POST mark or update attendance (Admin)
router.post("/mark", attendanceController.markAttendance);

// GET full attendance of a student (Student)
router.get("/:id", attendanceController.getStudentAttendance);

module.exports = router;
