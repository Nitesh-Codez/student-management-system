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
  deleteAssignment,
} = require("../controllers/assignmentController");

// Admin upload
router.post(
  "/admin/upload",
  adminUpload.single("file"),
  uploadAssignment
);

// Student upload
router.post(
  "/student/upload",
  studentUpload.single("file"),
  uploadAssignment
);

// Get by class
router.get("/class/:className", getAssignmentsByClass);

// Delete
router.delete("/:id", deleteAssignment);

module.exports = router;
