const express = require("express");
const router = express.Router();

// MUST BE PRESENT
const studentProfileController = require("../controllers/studentProfileController");

// Get profile by ID
router.get("/:id", studentProfileController.getStudentProfile);

// Get profile by password
router.post("/get", studentProfileController.getProfileByPassword);

module.exports = router;
