const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");

// Get all students
router.get("/", studentController.getStudents);

// Add new student
router.post("/", studentController.addStudent);

// Delete student by ID
router.delete("/:id", studentController.deleteStudent);

module.exports = router;
