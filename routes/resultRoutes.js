const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");

// ================== Admin Routes ==================
router.post("/create", quizController.createQuiz);
router.get("/admin/results/:class_name", quizController.getAdminResults);

// ================= Student Routes =================
// Note: "/status" should come before "/:id" to avoid route conflict
router.get("/class/:class_name", quizController.getQuizByClass);
router.get("/status/:quizId/:studentId", quizController.checkAttemptStatus);
router.get("/:id", quizController.getSingleQuiz);
router.post("/submit", quizController.submitQuiz);

module.exports = router;