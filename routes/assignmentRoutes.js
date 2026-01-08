const express = require("express");
const router = express.Router();
const multer = require("multer");

const adminUpload = multer({ dest: "assignments/admin/" });
const studentUpload = multer({ dest: "assignments/student/" });

const {
  uploadAssignment,
  getAllAssignments,
  submitAssignment,
  getSubmissions,
  deleteAssignment,
} = require("../controllers/assignmentController");

/* Admin */
router.post("/admin/upload", adminUpload.single("file"), uploadAssignment);
router.get("/admin/all", getAllAssignments);
router.get("/admin/:assignmentId/submissions", getSubmissions);

/* Student */
router.post(
  "/student/submit",
  studentUpload.single("file"),
  submitAssignment
);

/* Delete */
router.delete("/:id", deleteAssignment);

module.exports = router;
