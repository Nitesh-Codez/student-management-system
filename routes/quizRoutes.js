const express = require("express");
const router = express.Router();

// ✅ Import controller functions (destructure the exports)
const {
  createQuiz,
  getQuizByClass,
  getSingleQuiz,
  checkAttemptStatus,
  submitQuiz,
  getAdminResults
} = require("../controllers/quizController");

// ================== Admin Routes ==================
router.post("/create", createQuiz);
router.get("/admin/results/:class_name", getAdminResults);

// ================= Student Routes ==================
// Specific routes first to avoid conflict with parameterized route
router.get("/class/:class_name", getQuizByClass);
router.get("/status/:quizId/:studentId", checkAttemptStatus);
router.get("/:id", getSingleQuiz);
router.post("/submit", submitQuiz);

module.exports = router;