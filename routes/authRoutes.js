const express = require("express");
const router = express.Router();

const {
  loginController,
  banStudent,
  unbanStudent,
  getBannedStudents,
  setPattern,
  verifyPattern,
  disablePattern
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// Login — middleware nahi
router.post("/login", loginController);

// Admin routes
router.post("/ban", authMiddleware, adminMiddleware, banStudent);

router.post("/unban", authMiddleware, adminMiddleware, unbanStudent);

router.get(
  "/banned-students",
  authMiddleware,
  adminMiddleware,
  getBannedStudents
);

// Pattern routes — logged-in user
router.post("/set-pattern", authMiddleware, setPattern);

router.post("/verify-pattern", authMiddleware, verifyPattern);

router.post("/disable-pattern", authMiddleware, disablePattern);

module.exports = router;