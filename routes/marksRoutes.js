const express = require("express");
const router = express.Router();

const marksController = require("../controllers/marksController");

// ================= GET CLASSES =================
router.get("/classes", marksController.getClasses);

// ================= GET STUDENTS BY CLASS =================
router.get("/students/:className", marksController.getStudentsByClass);

// ================= ADD MARKS =================
router.post("/add", marksController.addMarks);

// ================= CHECK MARKS (STUDENT) =================
router.post("/check", marksController.checkMarks);

// ================= UPDATE MARKS (ADMIN) =================
router.put("/admin/marks/:id", marksController.updateMarks);

// ================= GET ALL MARKS (ADMIN) =================
router.get("/admin/marks", marksController.getAllMarks);

module.exports = router;
