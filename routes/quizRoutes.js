const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");

// Create Quiz (Admin)
router.post("/create", quizController.createQuiz);

// Get Quizzes by Class Name (For Students)
router.get("/class/:class_name", quizController.getQuizByClass);

// Get Specific Quiz Details
router.get("/:id", quizController.getSingleQuiz);

// Submit Quiz Result
router.post("/submit", quizController.submitQuiz);

module.exports = router;