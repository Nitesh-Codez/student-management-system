const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");

// Admin Routes
router.post("/create", quizController.createQuiz);
router.get("/admin/results/:class_name", quizController.getAdminResults);

// Student Routes
router.get("/class/:class_name", quizController.getQuizByClass);
router.get("/:id", quizController.getSingleQuiz);
router.get("/status/:quizId/:studentId", quizController.checkAttemptStatus);
router.post("/submit", quizController.submitQuiz);

module.exports = router;