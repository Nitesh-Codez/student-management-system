const express = require("express");
const router = express.Router();
const headAuth = require("../middlewares/headAuth");

const marksController = require("../controllers/marksController");

// ================= GET CLASSES =================
router.get("/classes", marksController.getClasses);

// ================= GET STUDENTS BY CLASS =================
router.get("/students/:className", marksController.getStudentsByClass);

// ================= ADD MARKS =================
router.post("/add", marksController.addMarks);

// ================= CHECK MARKS (STUDENT) =================
router.post("/check", marksController.checkMarks);

// ================= DELETE MARKS (ADMIN) =================
router.delete("/admin/marks/:id", marksController.deleteMarks);


// ================= UPDATE MARKS (ADMIN) =================
router.put(
  "/admin/marks/:id",
  headAuth,                // 🔐 protection
  marksController.updateMarks
);

// ================= GET ALL MARKS (ADMIN) =================
router.get("/admin/marks", marksController.getAllMarks);



module.exports = router;
