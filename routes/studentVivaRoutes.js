const express = require("express");
const router = express.Router();

const student = require("../controllers/studentVivaController");

router.get("/available", student.getAvailableVivas);

router.post("/:id/start", student.startViva);

router.post("/:attemptId/answer", student.submitVivaAnswer);

router.get("/:attemptId/next", student.getNextQuestion);

router.post("/:attemptId/complete", student.completeViva);

router.get("/history", student.getVivaHistory);

router.get("/report/:attemptId", student.getVivaReport);

module.exports = router;