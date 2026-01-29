const express = require("express");
const router = express.Router();
const multer = require("multer");

// ✅ Use memory storage for multer so req.file.buffer is available
const memoryStorage = multer.memoryStorage();

// Admin upload
const adminUpload = multer({ storage: memoryStorage });

// Student upload
const studentUpload = multer({ storage: memoryStorage });

const {
  uploadAssignment,
  getAssignmentsByClass,
  getTasksByClass,
  deleteAssignment,
  getSubmissionsByTask,
  updateRating
} = require("../controllers/assignmentController");

// ================= ROUTES =================

// Admin upload
router.post("/admin/upload", adminUpload.single("file"), uploadAssignment);

// Student upload
router.post("/student/upload", studentUpload.single("file"), uploadAssignment);

// Get assignments by class
router.get("/class/:className/:studentId", getAssignmentsByClass);

// Update student rating
router.put("/rating/:id", updateRating);

// Get admin tasks by class (for dropdown)
router.get("/admin/tasks/:className", getTasksByClass);

//For assignment edit
// routes/assignmentRoutes.js
router.put(
  "/admin/assignment/:id",
  upload.single("file"), // optional
  updateAdminAssignment
);


// Get submissions for a task
router.get("/admin/submissions/:task_title", getSubmissionsByTask);

// Delete assignment
router.delete("/:id", deleteAssignment);

module.exports = router;
