const express = require("express");
const router = express.Router();

// Dono controllers ko alag-alag naam se import karo
const studentController = require("../controllers/studentController");
const examController = require("../controllers/examController"); 

// CRUD
router.get("/", studentController.getStudents);
router.post("/", studentController.addStudent);
router.delete("/:id", studentController.deleteStudent);

// Profile photo (Admin only upload)
router.post(
  "/:id/profile-photo",
  studentController.uploadMiddleware.single("photo"),
  studentController.uploadProfilePhoto
);

// Profile photo view
router.get("/:id/profile-photo", studentController.getProfilePhoto);

// --- EXAM ROUTES ---

// Admit Card page is route ko use karega status check karne ke liye
router.get("/my-exam-details", examController.getMyExamDetails);

// Exam Form page is route ko use karega status 'Submitted' karne ke liye
router.post("/finalize-exam", examController.finalizeExamSubmission);

module.exports = router;