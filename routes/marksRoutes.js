const express = require("express");
const router = express.Router();
const marksController = require("../controllers/marksController");

// ADMIN ROUTES
router.get("/admin/classes", marksController.getClasses);
router.get("/admin/students/:className", marksController.getStudentsByClass);
router.post("/admin/add", marksController.addMarks);

// STUDENT ROUTES
router.get("/subjects", marksController.getSubjects);
router.get("/student/:id/:subject", marksController.getMarksByStudent);

module.exports = router;
