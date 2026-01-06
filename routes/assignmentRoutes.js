const express = require("express");
const router = express.Router();
const multer = require("multer");

// Multer config for temporary local storage
const upload = multer({ dest: "uploads/" });

const {
  uploadAssignment,
  getAssignmentsByClass,
  deleteAssignment,
} = require("../controllers/assignmentController");

// ================= UPLOAD =================
// Admin or Student upload
// FormData fields:
// file, role, userId, studentId, class_name, subject, task_title, task_id, deadline
router.post("/upload", upload.single("file"), uploadAssignment);

// ================= GET ASSIGNMENTS BY CLASS =================
// className param used to fetch all tasks/submissions for that class
router.get("/class/:className", getAssignmentsByClass);

// ================= DELETE =================
// Delete assignment by ID
router.delete("/:id", deleteAssignment);

module.exports = router;
