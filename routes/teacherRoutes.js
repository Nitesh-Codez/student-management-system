const express = require("express");
const router = express.Router();
const multer = require("multer");

const teacherController = require("../controllers/teacherController");

// multer memory storage (Supabase ke liye required)
const upload = multer({ storage: multer.memoryStorage() });


// ================= ADD TEACHER =================
router.post(
  "/add",
  upload.single("photo"),   // 👈 frontend field name "photo"
  teacherController.addTeacher
);


// ================= GET ALL =================
router.get("/admin/teachers", teacherController.getTeachers);


// ================= UPDATE =================
router.put(
  "/admin/teachers/:id",
  upload.single("photo"),   // 👈 image replace supported
  teacherController.updateTeacher
);


// ================= DELETE =================
router.delete("/admin/teachers/:id", teacherController.deleteTeacher);

module.exports = router;
