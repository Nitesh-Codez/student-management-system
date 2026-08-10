const express = require("express");
const router = express.Router();
const multer = require("multer");

const teacherController = require("../controllers/teacherController");

//Middlewares
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");


// multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ADD TEACHER (photo)
router.post("/add",authMiddleware,adminMiddleware, upload.single("photo"), teacherController.addTeacher);

// GET ALL
router.get("/admin/teachers",authMiddleware,adminMiddleware, teacherController.getTeachers); 

// UPDATE
router.put("/admin/teachers/:id",authMiddleware,adminMiddleware, upload.single("photo"), teacherController.updateTeacher);

// DELETE
router.delete("/admin/teachers/:id",authMiddleware,adminMiddleware, teacherController.deleteTeacher);

router.get("/all",authMiddleware,adminMiddleware, teacherController.getAllTeachers);


module.exports = router;
