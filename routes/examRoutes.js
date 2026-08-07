const express = require("express");
const router = express.Router();

const {
  getMyExamDetails,
  finalizeExamSubmission,
  getMySubjects,
  getTotalExamSubmissions,
  saveInternalMarks,
  getSubmittedStudentsForMarks
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

// ==============================
// (Admin side )Get All Exan forms
// ==============================
router.get("/admin/total-submissions", getTotalExamSubmissions);


//Internal marks section
// Get students who submitted the exam form + available subjects
router.get('/submitted-students', getSubmittedStudentsForMarks);

// Save or update internal evaluation marks (Tasks, Behavior, Performance)
router.post('/save-internal-marks', saveInternalMarks);

module.exports = router;