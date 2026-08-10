const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");

//Middlewares
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

/** * ==========================================
 * ADMIN SIDE ROUTES 
 * ==========================================
 */

// 1. Create a new quiz (Requires: class_name, subject, session, stream, title, questions)
router.post("/create",authMiddleware,adminMiddleware, quizController.createQuiz);

// 2. View all results for a class
// Usage: /api/quiz/admin/results/12?session=2026-27&stream=Science
router.get("/admin/results/:class_name",authMiddleware, adminMiddleware,quizController.getAdminResults);

// 3. Update specific question in a quiz
router.put("/update/:quizId/:questionIndex",authMiddleware,adminMiddleware, quizController.updateQuestion);

// 4. Delete quiz and its associated results
router.delete("/delete/:quizId",authMiddleware,adminMiddleware, quizController.deleteQuiz);


/** * ==========================================
 * STUDENT SIDE ROUTES 
 * ==========================================
 */

// 5. Get quizzes assigned to student's class (Filtered by Session & Stream)
// Usage: /api/quiz/class/12?session=2026-27&stream=Science
router.get("/class/:class_name",authMiddleware, quizController.getQuizByClass);

// 6. Get full quiz details (Questions/Timer) for attempting
router.get("/:id",authMiddleware, quizController.getSingleQuiz);

// 7. Check if student has already done this quiz (Lock mechanism)
router.get("/status/:quizId/:studentId",authMiddleware, quizController.checkAttemptStatus);

// 8. Final submission and score calculation
router.post("/submit",authMiddleware, quizController.submitQuiz);

// 9. Review quiz (Questions + Student Answers + Correct Answers)
router.get("/review/:quizId/:studentId",authMiddleware, quizController.getQuizReview);

module.exports = router;