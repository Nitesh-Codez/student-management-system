const express = require("express");
const router = express.Router();

const studentViva = require("../controllers/studentVivaController");

const bindHandler = (fn, exportName) => {
    if (typeof fn !== "function") {
        throw new Error(
            `[studentVivaRoutes] '${exportName}' is ${typeof fn}. Check exports in studentVivaController.js`
        );
    }
    return fn;
};

router.get(
    "/available",
    bindHandler(studentViva.getAvailableVivas, "getAvailableVivas")
);

router.post(
    "/:id/start",
    bindHandler(studentViva.startViva, "startViva")
);

router.post(
    "/attempt/:attemptId/answer",
    bindHandler(studentViva.submitVivaAnswer, "submitVivaAnswer")
);

router.get(
    "/attempt/:attemptId/next",
    bindHandler(studentViva.getNextQuestion, "getNextQuestion")
);

router.post(
    "/attempt/:attemptId/submit",
    bindHandler(studentViva.completeViva, "completeViva")
);

router.get(
    "/history",
    bindHandler(studentViva.getVivaHistory, "getVivaHistory")
);

router.get(
    "/report/:attemptId",
    bindHandler(studentViva.getVivaReport, "getVivaReport")
);

module.exports = router;