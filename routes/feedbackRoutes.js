const express = require("express");
const router = express.Router();
const { submitFeedback, getStudentFeedback, getAllFeedback } = require("../controllers/feedbackController");

// Student submits feedback
router.post("/student/submit", submitFeedback);

// Student views their own feedback (optional)
router.get("/student/:studentId", getStudentFeedback);

// Admin views all feedback
router.get("/admin/all", getAllFeedback);

module.exports = router;
