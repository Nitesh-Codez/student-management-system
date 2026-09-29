const express = require("express");
const router = express.Router();

const {
  getStudentSubjectAttendance,
  markSubjectAttendance,
  updateSubjectAttendance,
  deleteSubjectAttendance,
  getAdminSubjectAttendance,
} = require("../controllers/subjectAttendanceController");


// ======================================================
// ADMIN SUBJECT-WISE ATTENDANCE ROUTES
// ======================================================

// 1. Get particular student's subject-wise attendance
router.get(
  "/student/:studentId",
  getStudentSubjectAttendance
);


// 2. Mark subject attendance
router.post(
  "/mark",
  markSubjectAttendance
);


// 3. Update attendance
router.put(
  "/:id",
  updateSubjectAttendance
);


// 4. Delete attendance
router.delete(
  "/:id",
  deleteSubjectAttendance
);


// 5. Get admin attendance list
// Filters:
// ?class=12
// ?stream=Science
// ?session=2026-27
// ?subject_id=1
// ?date=2026-09-29
router.get(
  "/",
  getAdminSubjectAttendance
);


module.exports = router;