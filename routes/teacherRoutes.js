const express = require("express");
const router = express.Router();
const multer = require("multer");

const teacherController = require("../controllers/teacherController");

// multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ADD TEACHER (photo)
router.post("/add", upload.single("photo"), teacherController.addTeacher);

// GET ALL
router.get("/admin/teachers", teacherController.getTeachers); 

// UPDATE
router.put("/admin/teachers/:id", upload.single("photo"), teacherController.updateTeacher);

// DELETE
router.delete("/admin/teachers/:id", teacherController.deleteTeacher);

module.exports = router;
