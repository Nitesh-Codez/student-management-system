const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");

// CRUD
router.get("/", studentController.getStudents);
router.post("/", studentController.addStudent);
router.delete("/:id", studentController.deleteStudent);

// Profile photo (Admin only upload) WITHOUT middleware
router.post(
  "/:id/profile-photo",
  studentController.uploadMiddleware.single("photo"),
  studentController.uploadProfilePhoto
);

// Profile photo view (anyone can see)
router.get("/:id/profile-photo", studentController.getProfilePhoto);

module.exports = router;

