const express = require("express");
const router = express.Router();

const headAuth = require("../middlewares/headAuth");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

const marksController = require("../controllers/marksController");

// ================= GET CLASSES =================
router.get(
  "/classes",
  marksController.getClasses
);

// ================= GET STUDENTS BY CLASS =================
router.get(
  "/students/:className",
  marksController.getStudentsByClass
);

// ================= ADD MARKS =================
router.post(
  "/add",
  marksController.addMarks
);

// ================= CHECK MARKS (STUDENT) =================
router.post(
  "/check",
  marksController.checkMarks
);

// ================= DELETE MARKS (ADMIN) =================
router.delete(
  "/admin/marks/:id",
  headAuth,
  authMiddleware,
  adminMiddleware,
  marksController.deleteMarks
);

// ================= UPDATE MARKS (ADMIN) =================
router.put(
  "/admin/marks/:id",
  headAuth,              // 🔐 existing protection
  authMiddleware,       // 🔐 JWT authentication
  adminMiddleware,      // 🔐 admin role check
  marksController.updateMarks
);

// ================= GET ALL MARKS (ADMIN) =================
router.get(
  "/admin/marks",
  headAuth,
  authMiddleware,
  adminMiddleware,
  marksController.getAllMarks
);

module.exports = router;