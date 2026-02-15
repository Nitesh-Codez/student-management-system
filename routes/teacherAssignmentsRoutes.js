const express = require("express");
const router = express.Router();

// Controllers
const teacherAssignmentController = require("../controllers/teacherAssignmentController");


// ================= CREATE / ASSIGN CLASS =================
router.post("/assign", teacherAssignmentController.assignClass);

// ================= GET ALL ASSIGNMENTS =================
router.get("/all", teacherAssignmentController.getAssignments);

router.get("/student/:class_name/:date", teacherAssignmentController.getStudentLectures);

// ================= UPDATE ASSIGNMENT =================
router.put("/update/:id", teacherAssignmentController.updateAssignment);

// ================= DELETE ASSIGNMENT =================
router.delete("/delete/:id", teacherAssignmentController.deleteAssignment);
// ================= GET LECTURES BY TEACHER ID =================

// ================= BULK SUSPEND / HOLIDAY =================
router.post("/suspend-day", teacherAssignmentController.suspendDay);

router.get("/teacher/:teacher_id", teacherAssignmentController.getTeacherLectures);

module.exports = router;
