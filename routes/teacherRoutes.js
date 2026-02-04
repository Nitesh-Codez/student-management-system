const express = require("express");
const router = express.Router();
const headAuth = require("../middlewares/headAuth");

const teacherController = require("../controllers/teacherController");

// ADD TEACHER
router.post("/add", headAuth, teacherController.addTeacher);

// GET ALL
router.get("/admin/teachers", headAuth, teacherController.getTeachers);

// UPDATE
router.put("/admin/teachers/:id", headAuth, teacherController.updateTeacher);

// DELETE
router.delete("/admin/teachers/:id", headAuth, teacherController.deleteTeacher);

module.exports = router;
