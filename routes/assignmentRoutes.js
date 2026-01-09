const express = require("express");
const router = express.Router();
const multer = require("multer");

// ✅ admin ke liye admin folder
const adminUpload = multer({ dest: "assignments/admin/" });

// ✅ student ke liye student folder
const studentUpload = multer({ dest: "assignments/student/" });

const {
  uploadAssignment,
  getAssignmentsByClass,
  getTasksByClass,
  deleteAssignment,
  getSubmissionsByTask
} = require("../controllers/assignmentController");

// Admin upload
router.post("/admin/upload", adminUpload.single("file"), uploadAssignment);

// Student upload
router.post("/student/upload", studentUpload.single("file"), uploadAssignment);

// Get assignments by class
router.get("/class/:className/:studentId", getAssignmentsByClass);


// Get admin tasks by class (for dropdown)
router.get("/admin/tasks/:className", getTasksByClass);

// Get submissions for a task
router.get("/admin/submissions/:task_title", getSubmissionsByTask);

// Delete assignment
router.delete("/:id", deleteAssignment);

module.exports = router;
