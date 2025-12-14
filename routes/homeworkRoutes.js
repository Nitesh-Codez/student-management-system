const express = require("express");
const router = express.Router();
const multer = require("multer");
const studyMaterialController = require("../controllers/studyMaterialController");

// =========================
// MULTER CONFIG
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname)
});
const upload = multer({ storage });

// =========================
// ADMIN ROUTES
// =========================

// Upload study material
router.post("/admin/upload", upload.single("file"), studyMaterialController.uploadMaterial);

// Delete material
router.delete("/admin/:id", studyMaterialController.deleteMaterial);

// Get all materials
router.get("/admin/all", studyMaterialController.getAllMaterials);

// =========================
// STUDENT ROUTES
// =========================

// Get subjects by class
router.get("/subjects/:class", studyMaterialController.getSubjectsByClass);

// Get materials by class and subject
router.get("/:class/:subject", studyMaterialController.getMaterialByClassAndSubject);

module.exports = router;
