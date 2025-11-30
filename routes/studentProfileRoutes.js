const express = require("express");
const router = express.Router();
const { getProfile, saveProfile } = require("../controllers/studentProfileController");

router.get("/:studentCode", getProfile);
router.post("/", saveProfile);

module.exports = router;
