const express = require("express");
const router = express.Router();

const {
  submitFeedback,
  getStudentFeedback,
  getAllFeedback,
  getAdminFeedbackSummary
} = require("../controllers/feedbackController");

// ✅ Student
router.post("/student/submit", submitFeedback);
router.get("/student/:studentId", getStudentFeedback);

// ✅ Admin
router.get("/admin/all", getAllFeedback);
router.get("/admin/summary", getAdminFeedbackSummary);

module.exports = router;
