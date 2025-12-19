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
    const uploadPath = path.join(
      "uploads",
      "study-material",
      `class-${req.body.class_name}`
    );

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // ✅ original filename, number nahi lagega
    const cleanName = file.originalname
      .replace(/\s+/g, "-")          // spaces -> dash
      .replace(/[^a-zA-Z0-9.-]/g, ""); // remove special chars

    cb(null, cleanName);
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
