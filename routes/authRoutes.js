const express = require("express");
const router = express.Router();

const {
 loginController,
 banStudent,
 unbanStudent,
 getBannedStudents
} = require("../controllers/authController");

// Login
router.post("/login", loginController);

// Ban Student
router.post("/ban", banStudent);

// Unban Student
router.post("/unban", unbanStudent);

module.exports = router;