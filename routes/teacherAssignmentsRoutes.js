const express = require("express");
const router = express.Router();

// Controllers
const teacherAssignmentController = require("../controllers/teacherAssignmentController");
const teacherController = require("../controllers/teacherController"); // ✅ IMPORT MISSING

// ================= CREATE / ASSIGN CLASS =================
router.post("/assign", teacherAssignmentController.assignClass);

// ================= GET ALL ASSIGNMENTS =================
router.get("/all", teacherAssignmentController.getAssignments);

// ================= GET ALL TEACHERS =================
router.get("/admin/teachers", teacherController.getTeachers); // ✅ now works

// ================= UPDATE ASSIGNMENT =================
router.put("/update/:id", teacherAssignmentController.updateAssignment);

// ================= DELETE ASSIGNMENT =================
router.delete("/delete/:id", teacherAssignmentController.deleteAssignment);

module.exports = router;
