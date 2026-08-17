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

router.get("/attendance/current-marks",authMiddleware,adminMiddleware, newMarksController.getCurrentAttendanceMarks);

router.get("/by-date",authMiddleware,adminMiddleware, newMarksController.getMarksByDate);
router.put("/update/:id",authMiddleware,adminMiddleware, newMarksController.updateMarks);
router.get(
  "/current-session-marks",
  newMarksController.getCurrentSessionMarks
);
router.get(
  "/current-session-internal-marks/:studentId",
  newMarksController.getCurrentSessionMarks
);

module.exports = router;
//