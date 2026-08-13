const express = require("express");
const router = express.Router();

const meetingController = require("../controllers/meetingController");

const {
  authMiddleware,
  adminMiddleware
} = require("../middleware/authMiddleware");


// ========================================
// ADMIN
// ========================================

// Create meeting
router.post(
  "/admin/create",
  authMiddleware,
  adminMiddleware,
  meetingController.createMeeting
);

// All meetings
router.get(
  "/admin/all",
  authMiddleware,
  adminMiddleware,
  meetingController.getAllMeetings
);

// Meeting attendance
router.get(
  "/admin/:meetingId/attendance",
  authMiddleware,
  adminMiddleware,
  meetingController.getMeetingAttendance
);


// ========================================
// STUDENT
// ========================================

// type = PARENTS / STUDENTS
router.get(
  "/student",
  authMiddleware,
  meetingController.getStudentMeetings
);

// Mark attendance
router.post(
  "/student/:meetingId/attendance",
  authMiddleware,
  meetingController.markAttendance
);


module.exports = router;