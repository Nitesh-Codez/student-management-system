const express = require("express");
const router = express.Router();

// Dono controllers ko alag-alag naam se import karo//ab dekh
const studentController = require("../controllers/studentController");
const examController = require("../controllers/examController"); 

//Middlewares
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");


// CRUD
router.get("/",authMiddleware,adminMiddleware, studentController.getStudents);
router.post("/",authMiddleware,adminMiddleware, studentController.addStudent);
router.delete("/:id",authMiddleware,adminMiddleware, studentController.deleteStudent);

// Profile photo (Admin only upload)
router.post(
  "/:id/profile-photo",
  authMiddleware,
  adminMiddleware,
  studentController.uploadMiddleware.single("photo"),
  studentController.uploadProfilePhoto
);

// Profile photo view
router.get("/:id/profile-photo",authMiddleware, studentController.getProfilePhoto);

// --- EXAM ROUTES ---

// Admit Card page is route ko use karega status check karne ke liye
router.get("/my-exam-details",authMiddleware, examController.getMyExamDetails);

// Exam Form page is route ko use karega status 'Submitted' karne ke liye
router.post("/finalize-exam",authMiddleware, examController.finalizeExamSubmission);

//for saving history
router.get("/class-history",authMiddleware, studentController.getStudentClassHistory);

module.exports = router;