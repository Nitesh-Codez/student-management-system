const express = require("express");
const router = express.Router();
const newMarksController = require("../controllers/newMarksController");

router.get("/classes", newMarksController.getClasses);
router.get("/students/:className", newMarksController.getStudentsByClass);
router.post("/add", newMarksController.addMarks);
router.post("/check", newMarksController.checkMarks);

module.exports = router;
