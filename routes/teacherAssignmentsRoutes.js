const express = require("express");
const router = express.Router();

// Controllers
const teacherAssignmentController = require("../controllers/teacherAssignmentController");

//Middlewares
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");


// ================= CREATE / ASSIGN CLASS =================
router.post("/assign",authMiddleware,adminMiddleware, teacherAssignmentController.assignClass);

// ================= GET ALL ASSIGNMENTS =================
router.get("/all",authMiddleware,adminMiddleware, teacherAssignmentController.getAssignments);

router.get("/student/:class_name/:date",authMiddleware, teacherAssignmentController.getStudentLectures);

// ================= UPDATE ASSIGNMENT =================
router.put("/update/:id",authMiddleware,adminMiddleware, teacherAssignmentController.updateAssignment);

// ================= DELETE ASSIGNMENT =================
router.delete("/delete/:id",authMiddleware,adminMiddleware, teacherAssignmentController.deleteAssignment);
// ================= GET LECTURES BY TEACHER ID =================

// ================= BULK SUSPEND / HOLIDAY =================
router.post("/suspend-day",authMiddleware,adminMiddleware, teacherAssignmentController.suspendDay);

router.get("/teacher/:teacher_id",authMiddleware,adminMiddleware, teacherAssignmentController.getTeacherLectures);

module.exports = router;
