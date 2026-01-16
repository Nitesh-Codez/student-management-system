const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const { verifyToken, isAdmin } = require("../middlewares/auth");

// CRUD
router.get("/", studentController.getStudents);
router.post("/", studentController.addStudent);
router.delete("/:id", studentController.deleteStudent);

// Profile photo (Admin only upload)
router.post(
  "/:id/profile-photo",
  verifyToken,
  isAdmin,
  studentController.uploadMiddleware.single("photo"),
  studentController.uploadProfilePhoto
);

// Profile photo view (Admin + Student)
router.get("/:id/profile-photo", verifyToken, studentController.getProfilePhoto);

module.exports = router;
