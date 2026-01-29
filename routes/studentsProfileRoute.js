const express = require("express");
const router = express.Router();
const { getStudentProfile } = require("../controllers/studentsProfileController");

// GET /api/students/profile?id=27
router.get("/profile", getStudentProfile);

module.exports = router;
