const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  uploadStudyMaterial,
  getMaterialByClass,
  downloadMaterial,
  deleteMaterial,
} = require("../controllers/studyMaterialController");

const router = express.Router();

// ================= MULTER =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Absolute path using __dirname
    const uploadPath = path.join(__dirname, "..", "uploads", "study-material", `class-${req.body.class_name}`);
    
    // Folder auto create if not exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log("Folder created:", uploadPath);
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Keep original file name
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF allowed"));
    }
    cb(null, true);
  },
});

// ================= ROUTES =================
router.post("/upload", upload.single("file"), uploadStudyMaterial);
router.get("/download/:id", downloadMaterial);
router.get("/:className", getMaterialByClass);
router.delete("/:id", deleteMaterial);

module.exports = router;
