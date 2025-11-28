const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");

// GET list of students for a specific date
router.get("/list", attendanceController.getStudentsList);

// POST mark or update attendance
router.post("/mark", attendanceController.markAttendance);

module.exports = router;
