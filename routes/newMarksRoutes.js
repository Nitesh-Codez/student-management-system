const express = require("express");
const router = express.Router();
const newMarksController = require("../controllers/newMarksController");
//Middlewares
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

router.get("/classes",authMiddleware, adminMiddleware, newMarksController.getClasses);
router.get("/students/:className",authMiddleware, adminMiddleware, newMarksController.getStudentsByClass);
router.post("/add",authMiddleware, adminMiddleware, newMarksController.addMarks);
router.post("/check",authMiddleware, newMarksController.checkMarks);

router.get("/attendance/current-marks", newMarksController.getCurrentAttendanceMarks);

app.use("/api/marks", marksRoutes);

module.exports = router;
//