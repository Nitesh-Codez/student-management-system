const express = require("express");
const router = express.Router();

const {
  getMyExamDetails,
  finalizeExamSubmission,
  getMySubjects,
} = require("../controllers/examController");

// ==============================
// Get Exam Details
// ==============================
router.get("/my-exam-details", getMyExamDetails);

// ==============================
// Submit / Finalize Exam Form
// ==============================
router.post("/finalize-exam-submission", finalizeExamSubmission);

// ==============================
// Get My Subjects
// ==============================
router.get("/my-subjects", getMySubjects);

module.exports = router;