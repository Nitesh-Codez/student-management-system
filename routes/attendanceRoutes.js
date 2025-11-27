const express = require("express");
const router = express.Router();
const { getAttendanceByDate, markAttendance } = require("../controllers/attendanceController");

router.get("/", getAttendanceByDate);
router.post("/", markAttendance);

module.exports = router;
