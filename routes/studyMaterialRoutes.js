const express = require("express");
const multer = require("multer");
const {
  uploadStudyMaterial,
  getMaterialByClass,
  deleteMaterial,
} = require("../controllers/studyMaterialController");

//Middlewares
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

const router = express.Router();

// ✅ Ye memory storage use karega taaki Render ka temp folder wala issue na ho
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/upload",authMiddleware,adminMiddleware, upload.single("file"), uploadStudyMaterial);
router.get("/:className",authMiddleware,getMaterialByClass);
router.delete("/:id",authMiddleware,adminMiddleware, deleteMaterial);

module.exports = router;