const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");

/** =========================
 * ADMIN SIDE ROUTES
 ========================== */

// 1. Create Quiz
router.post("/create", quizController.createQuiz);

// 2. Admin Results (FILTER BASED)
router.get("/admin/results", quizController.getAdminResults);


/** =========================
 * STUDENT SIDE ROUTES
 ========================== */

// 3. Get Quiz List (FILTER BASED)
router.get("/", quizController.getQuizByFilter);

// 4. Get Single Quiz
router.get("/:id", quizController.getSingleQuiz);

// 5. Check Attempt Status
router.get("/status/:quizId/:studentId", quizController.checkAttemptStatus);

// 6. Submit Quiz
router.post("/submit", quizController.submitQuiz);

// 7. Review Quiz
router.get("/review/:quizId/:studentId", quizController.getQuizReview);


/** =========================
 * ADMIN EXTRA ROUTES
 ========================== */

// 8. Update Question
router.put("/update/:quizId/:questionIndex", quizController.updateQuestion);

// 9. Delete Quiz
router.delete("/delete/:quizId", quizController.deleteQuiz);

module.exports = router;