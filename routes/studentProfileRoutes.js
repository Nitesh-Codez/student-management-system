const express = require("express");
const router = express.Router();
const { getProfile, saveProfile } = require("../controllers/studentProfileController");

// Fetch profile using password only
router.post("/get", getProfile);

// Save or update profile using password only
router.post("/save", saveProfile);

module.exports = router;
