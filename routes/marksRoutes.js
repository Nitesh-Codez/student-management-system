const express = require("express");
const router = express.Router();
//Middlewares
const headAuth = require("../middlewares/headAuth");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

//Controllers
const marksController = require("../controllers/marksController");

// ================= GET CLASSES =================
router.get("/classes",authMiddleware, marksController.getClasses);

// ================= GET STUDENTS BY CLASS =================
router.get("/students/:className",authMiddleware,adminMiddleware, marksController.getStudentsByClass);

// ================= ADD MARKS =================
router.post("/add",authMiddleware,adminMiddleware, marksController.addMarks);

// ================= CHECK MARKS (STUDENT) =================
router.post("/check",authMiddleware, marksController.checkMarks);

// ================= DELETE MARKS (ADMIN) =================
router.delete("/admin/marks/:id",authMiddleware,adminMiddleware, marksController.deleteMarks);

// ================= UPDATE MARKS (ADMIN) =================
router.put(
 "/admin/marks/:id",
 authMiddleware,
 adminMiddleware,
headAuth, // 🔐 protection
marksController.updateMarks
);

// ================= GET ALL MARKS (ADMIN) =================
router.get("/admin/marks",authMiddleware,adminMiddleware, marksController.getAllMarks);

// Student - Get Internal Marks
router.get("/student/internal-marks", marksController.getMyInternalMarks);

module.exports = router;

