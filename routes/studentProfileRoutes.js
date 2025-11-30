const express = require("express");
const router = express.Router();
const { getProfile, saveProfile } = require("../controllers/studentProfileController");

// Get profile by student code
router.get("/:studentCode", getProfile);

// Save or update profile
router.post("/", saveProfile);

module.exports = router;
