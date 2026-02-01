const express = require("express");
const router = express.Router();

const { getStudentProfile } = require("../controllers/studentsProfileController");
const { insertStudent } = require("../controllers/studentsController");

// GET profile
// /api/students/profile?id=27
router.get("/profile", getStudentProfile);

// INSERT student
// /api/students/add
router.post("/add", insertStudent);

module.exports = router;
