const express = require("express");
const router = express.Router();
const { getProfileById } = require("../controllers/studentProfileController");

// POST route
router.post("/get", getProfileById);

module.exports = router;
