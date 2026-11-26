const express = require("express");
const router = express.Router();

const student = require("../controllers/studentVivaController");

router.get("/available", student.getAvailableVivas);

router.post("/:id/start", student.startViva);

// Answer save/evaluate
router.post("/attempt/:attemptId/answer", student.submitVivaAnswer);

// Next question
router.get("/attempt/:attemptId/next", student.getNextQuestion);

// Complete viva
router.post("/attempt/:attemptId/submit", student.completeViva);

// History
router.get("/history", student.getVivaHistory);

// Report
router.get("/report/:attemptId", student.getVivaReport);