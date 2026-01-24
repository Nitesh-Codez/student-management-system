const express = require("express");
const multer = require("multer");
const {
  uploadStudyMaterial,
  getMaterialByClass,
  deleteMaterial,
} = require("../controllers/studyMaterialController");

const router = express.Router();

// ✅ Memory storage use karein taki Render folder permissions ka error na de
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/upload", upload.single("file"), uploadStudyMaterial);
router.get("/:className", getMaterialByClass);
router.delete("/:id", deleteMaterial);

module.exports = router;