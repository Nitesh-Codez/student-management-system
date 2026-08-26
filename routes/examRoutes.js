const express = require("express");
const router = express.Router();

const {
  getMyExamDetails,
  finalizeExamSubmission,
  getMySubjects,
  getTotalExamSubmissions,
  saveInternalMarks,
  getSubmittedStudentsForMarks,
  getMyInternalMarks
} = require("../controllers/examController");

//Middlewares//////
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

// ==============================
// Get Exam Details
// ==============================
router.get("/my-exam-details",authMiddleware, getMyExamDetails);

// ==============================
// Submit / Finalize Exam Form
// ==============================
router.post("/finalize-exam-submission",authMiddleware, finalizeExamSubmission);

// ==============================
// Get My Subjects
// ==============================
router.get("/my-subjects",authMiddleware, getMySubjects);

// ==============================
// (Admin side )Get All Exan forms
// ==============================
router.get("/admin/total-submissions",authMiddleware, getTotalExamSubmissions);


//Internal marks section
// Get students who submitted the exam form + available subjects
router.get('/submitted-students',authMiddleware, getSubmittedStudentsForMarks);

// Save or update internal evaluation marks (Tasks, Behavior, Performance)
router.post('/save-internal-marks',authMiddleware, saveInternalMarks);
// Student - Get Internal Marks
router.get("/student/internal-marks",authMiddleware, getMyInternalMarks);

module.exports = router;