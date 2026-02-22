const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");

/** * ADMIN SIDE ROUTES 
 */
// 1. Create a new quiz
router.post("/create", quizController.createQuiz);
// 2. View all results for a class (Includes Student Names, Grade, Time)
router.get("/admin/results/:class_name", quizController.getAdminResults);

/** * STUDENT SIDE ROUTES 
 */
// 3. Get all quizzes assigned to student's class
router.get("/class/:class_name", quizController.getQuizByClass);
// 4. Get full quiz details (Questions/Timer) for attempting
router.get("/:id", quizController.getSingleQuiz);
// 5. Check if student has already done this quiz (Lock mechanism)
router.get("/status/:quizId/:studentId", quizController.checkAttemptStatus);
// 6. Final submission and score calculation
router.post("/submit", quizController.submitQuiz);

module.exports = router;