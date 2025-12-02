const express = require("express");
const router = express.Router();
const { getProfileById } = require("../controllers/profileController");

// POST → fetch profile by ID
router.post("/get", getProfileById);

module.exports = router;
