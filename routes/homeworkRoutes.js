const express = require("express");
const router = express.Router();
const homeworkController = require("../controllers/homeworkController");

// Get all students (frontend needs it for class & student select)
router.get("/students", homeworkController.getAllStudents);

// Get homework list by class
router.get("/:class", homeworkController.getHomeworkByClass);

// Add homework
router.post("/add", homeworkController.addHomework);

// Update homework status
router.patch("/status", homeworkController.updateStatus);

module.exports = router;
