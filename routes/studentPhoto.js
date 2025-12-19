const express = require("express");
const router = express.Router();
const { upload, uploadStudentPhoto } = require("../controllers/studentPhotoController");

// ================= ROUTES =================
router.post("/upload/student-photo", upload.single("photo"), uploadStudentPhoto);

module.exports = router;
