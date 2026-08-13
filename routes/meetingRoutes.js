const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

const meetingController = require("../controllers/meetingController");



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

// All meetings
router.get(
  "/student",
  authMiddleware,
  meetingController.getStudentMeetings
);


// Students meetings only
// /meeting/student?type=STUDENTS


// Parents meetings only
// /meeting/student?type=PARENTS


// Mark attendance when joining
router.post(
  "/student/:meetingId/attendance",
  authMiddleware,
  meetingController.markAttendance
);



module.exports = router;