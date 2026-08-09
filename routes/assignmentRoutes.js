const express = require("express");
const router = express.Router();
const multer = require("multer");

//Middlewares
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

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
  updateRating,
  updateAdminAssignment   // ✅ ADD THIS
} = require("../controllers/assignmentController");

// ================= ROUTES =================

// Admin upload
router.post("/admin/upload", authMiddleware,adminMiddleware, adminUpload.single("file"), uploadAssignment);

// Student upload
router.post("/student/upload",authMiddleware, studentUpload.single("file"), uploadAssignment);

// Get assignments by class
router.get("/class/:className/:studentId",authMiddleware, getAssignmentsByClass);

// Update student rating
router.put("/rating/:id",authMiddleware,adminMiddleware, updateRating);

// Get admin tasks by class (for dropdown)
router.get("/admin/tasks/:className",authMiddleware,adminMiddleware, getTasksByClass);

//For assignment edit
// routes/assignmentRoutes.js
router.put(
  "/admin/assignment/:id",
  authMiddleware,
  adminUpload.single("file"),
  updateAdminAssignment
);


// Get submissions for a task
router.get("/admin/submissions/:task_title",authMiddleware,getSubmissionsByTask);

// Delete assignment
router.delete("/:id", authMiddleware, deleteAssignment);

module.exports = router;
