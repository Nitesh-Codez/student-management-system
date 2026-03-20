const express = require("express");
const router = express.Router();

const {
  getStudentProfile,
  insertStudent,
  updateStudentProfile,
  requestProfileEdit,
  handleEditRequest,
  getPendingEditRequests,
  getEditRequests,
} = require("../controllers/studentsProfileController");

// ================= STUDENT PROFILE ROUTES =================

// GET profile: /api/students/profile?id=27
router.get("/profile", getStudentProfile);

// INSERT new student: /api/students/add
router.post("/add", insertStudent);

// UPDATE student profile: /api/students/update/27
router.put("/update/:id", updateStudentProfile);

// ================= PROFILE EDIT REQUESTS (Workflow) =================

// Student side: Request an edit
router.post("/request-edit", requestProfileEdit);

// Admin side: Approve or Reject a request
router.post("/handle-edit", handleEditRequest);

// Admin side: Get all pending requests
router.get("/pending-edit-requests", getPendingEditRequests);

// Student/Admin side: Get all history of edit requests for a specific student
// /api/students/edit-requests?id=27
router.get("/edit-requests", getEditRequests);

module.exports = router;