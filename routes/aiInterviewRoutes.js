
const express = require("express");
const router = express.Router();

const {
    startInterview,
    evaluateAnswer,
    getNextQuestion,
    completeInterview,
    getInterviewHistory,
    getInterviewReport
} = require("../controllers/aiInterviewController");

const authMiddleware = require("../middlewares/authMiddleware");

router.use(authMiddleware);

router.post("/start", startInterview);
router.post("/evaluate", evaluateAnswer);
router.get("/next/:interviewId", getNextQuestion);
router.post("/complete", completeInterview);
router.get("/history", getInterviewHistory);
router.get("/report/:interviewId", getInterviewReport);

module.exports = router;
