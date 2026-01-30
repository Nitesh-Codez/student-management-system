const express = require("express");
const router = express.Router();
const marksController = require("../controllers/marksController");

// Get classes list
router.get("/classes", marksController.getClasses);

// Get students by class
router.get("/students/:className", marksController.getStudentsByClass);

// Add marks
router.post("/add", marksController.addMarks);
router.post("/check", marksController.checkMarks);

// ================= EDIT MARKS =================
router.put("/admin/marks/:id", marksController.updateMarks);

//Get all marks
router.get("/admin/marks", marksController.getAllMarks);




module.exports = router;
