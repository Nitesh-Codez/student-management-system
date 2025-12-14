const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const {
  uploadMaterial,
  getAllMaterials,
  deleteMaterial,
  getSubjectsByClass,
  getMaterialByClassAndSubject
} = require("../controllers/studyMaterialController");

// =====================
// MULTER SETUP FOR FILE UPLOAD
// =====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// =====================
// ROUTES
// =====================

// Admin upload study material
router.post("/admin/upload", upload.single("file"), uploadMaterial);

// Admin get all materials
router.get("/admin/materials", getAllMaterials);

// Admin delete material
router.delete("/admin/:id", deleteMaterial);

// Get subjects by class
router.get("/subjects/:class", getSubjectsByClass);

// Get materials by class & subject (student view)
router.get("/:class/:subject", getMaterialByClassAndSubject);

module.exports = router;
