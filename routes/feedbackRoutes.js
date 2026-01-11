const express = require("express");
const router = express.Router();

const {
  submitFeedback,
  getStudentFeedback,
  getAllFeedback
} = require("../controllers/feedbackController");

// ✅ Submit feedback (student)
router.post("/student/submit", submitFeedback);

// ✅ Get feedback for a single student
router.get("/student/:studentId", getStudentFeedback);

// ✅ Get all feedback (admin)
router.get("/admin/all", getAllFeedback);

module.exports = router;
