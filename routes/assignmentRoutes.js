const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const {
  uploadAssignment,
  getAssignmentsByClass,
  deleteAssignment,
} = require("../controllers/assignmentController");

// Admin upload
router.post("/admin/upload", upload.single("file"), uploadAssignment);

// Student upload
router.post("/student/upload", upload.single("file"), uploadAssignment);

// Get assignments/submissions by class
router.get("/class/:className", getAssignmentsByClass);

// Delete assignment
router.delete("/:id", deleteAssignment);

module.exports = router;
