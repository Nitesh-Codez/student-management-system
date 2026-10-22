const express = require("express");
const router = express.Router();

const {
  submitFeedback,
  getStudentFeedback,
  getAllFeedback,
  getAdminFeedbackSummary,
  getTeachersByClass
} = require("../controllers/feedbackController");

//Middlewares
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

// Student
router.post("/student/submit",authMiddleware, submitFeedback);
router.get("/student/:studentId",authMiddleware, getStudentFeedback);

// Admin
router.get("/admin/all",authMiddleware,adminMiddleware, getAllFeedback);
router.get("/admin/summary",authMiddleware,adminMiddleware, getAdminFeedbackSummary);

router.get(
  "/class-sub-teacher/:class_name",
  teacherAssignmentController.getTeachersByClass
);

module.exports = router;
