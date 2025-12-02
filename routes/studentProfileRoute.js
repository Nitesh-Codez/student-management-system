const express = require("express");
const router = express.Router();
const { getStudentProfile } = require("../controllers/studentProfileController");

// GET /api/student-profile/:id
router.get("/:id", studentProfileController.getStudentProfile);

module.exports = router;
