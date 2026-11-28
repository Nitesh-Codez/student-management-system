
const express = require("express");
const router = express.Router();

const aiInterview = require("../controllers/aiInterviewController");
const authMiddleware = require("../middlewares/authMiddleware");

const bindHandler = (fn, name) => {
    if (typeof fn !== "function") {
        throw new Error(
            `[aiInterviewRoutes] '${name}' is missing in aiInterviewController.js`
        );
    }
    return fn;
};

// Authentication for all routes
router.use(authMiddleware);

// AI Interview Routes
router.post(
    "/start",
    bindHandler(aiInterview.startInterview, "startInterview")
);

router.post(
    "/evaluate",
    bindHandler(aiInterview.evaluateAnswer, "evaluateAnswer")
);

router.get(
    "/next/:interviewId",
    bindHandler(aiInterview.getNextQuestion, "getNextQuestion")
);

router.post(
    "/complete",
    bindHandler(aiInterview.completeInterview, "completeInterview")
);

router.get(
    "/history",
    bindHandler(aiInterview.getInterviewHistory, "getInterviewHistory")
);

router.get(
    "/report/:interviewId",
    bindHandler(aiInterview.getInterviewReport, "getInterviewReport")
);

// Viva Email Verification (Send + Verify OTP)
router.post(
    "/email-verification",
    bindHandler(aiInterview.vivaEmailVerification, "vivaEmailVerification")
);

module.exports = router;
