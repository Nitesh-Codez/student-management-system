const express = require("express");
const router = express.Router();

const studentViva = require("../controllers/studentVivaController");

router.get("/available", studentViva.getAvailableVivas);
router.post("/:id/start", studentViva.startViva);
router.post("/attempt/:attemptId/answer", studentViva.submitVivaAnswer);
router.get("/attempt/:attemptId/next", studentViva.getNextQuestion);
router.post("/attempt/:attemptId/submit", studentViva.completeViva);
router.get("/history", studentViva.getVivaHistory);
router.get("/report/:attemptId", studentViva.getVivaReport);

module.exports = router;