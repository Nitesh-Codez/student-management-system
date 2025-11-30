const express = require("express");
const router = express.Router();
const homeworkController = require("../controllers/homeworkController");

router.get("/classes", homeworkController.getClasses);
router.get("/:class", homeworkController.getHomeworkByClass);
router.post("/add", homeworkController.addHomework);
router.patch("/status", homeworkController.updateStatus);

module.exports = router;
