const express = require("express");
const router = express.Router();

const teacherController = require("../controllers/teacherController");

// ADD TEACHER
router.post("/add", teacherController.addTeacher);

// GET ALL
router.get("/admin/teachers", teacherController.getTeachers);

// UPDATE
router.put("/admin/teachers/:id", teacherController.updateTeacher);

// DELETE
router.delete("/admin/teachers/:id", teacherController.deleteTeacher);

module.exports = router;
