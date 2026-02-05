const express = require("express");
const router = express.Router();
const teacherAssignmentController = require("../controllers/teacherAssignmentController");

// CREATE / ASSIGN CLASS
router.post("/assign", teacherAssignmentController.assignClass);

// GET ALL ASSIGNMENTS
router.get("/all", teacherAssignmentController.getAssignments);

// UPDATE ASSIGNMENT
router.put("/update/:id", teacherAssignmentController.updateAssignment);

// DELETE ASSIGNMENT
router.delete("/delete/:id", teacherAssignmentController.deleteAssignment);

module.exports = router;
