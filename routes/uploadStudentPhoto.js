const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const {
  uploadStudyMaterial,
  getMaterialByClass,
  downloadMaterial,
  deleteMaterial,
} = require("../controllers/studyMaterialController");

// ========== MULTER ==========
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/study_materials"); // 🔥 FIXED
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// 🔥 ROUTE ORDER MAT CHANGE KARNA
router.get("/download/:id", downloadMaterial);
router.post("/upload", upload.single("file"), uploadStudyMaterial);
router.get("/:className", getMaterialByClass);
router.delete("/:id", deleteMaterial);

module.exports = router;
