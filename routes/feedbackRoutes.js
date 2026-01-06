const express = require("express");
const router = express.Router();
const { submitFeedback, getStudentFeedback, getAllFeedback } = require("../controllers/feedbackController");

// POST feedback (student)
router.post("/student/submit", submitFeedback);

// GET feedback for a single student
router.get("/student/:studentId", getStudentFeedback);

// GET all feedback (admin)
router.get("/all", getAllFeedback);

module.exports = router;
