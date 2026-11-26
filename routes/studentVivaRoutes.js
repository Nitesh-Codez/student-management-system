const express = require("express");
const router = express.Router();

const student = require("../controllers/studentVivaController");

const authMiddleware = require("../middleware/authMiddleware");

router.get("/available", authMiddleware, student.getAvailableVivas);

router.post("/:id/start", authMiddleware, student.startViva);

router.post("/:attemptId/answer",authMiddleware, student.submitVivaAnswer);

router.get("/:attemptId/next", authMiddleware, student.getNextQuestion);

router.post("/:attemptId/complete", protect, student.completeViva);

router.get("/history", protect, student.getVivaHistory);

router.get("/report/:attemptId", protect, student.getVivaReport);

module.exports = router;