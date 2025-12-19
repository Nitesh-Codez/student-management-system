const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  uploadStudyMaterial,
  getMaterialByClass,
  deleteMaterial,
} = require("../controllers/studyMaterialController");

const router = express.Router();

// ================= MULTER CONFIG =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const className = req.body.class_name;
    const uploadPath = path.join(
      "uploads",
      "study-material",
      `class-${className}`
    );

    // auto-create folder
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

// only PDF allowed
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"));
    }
    cb(null, true);
  },
});

// ================= ROUTES =================
router.post("/upload", upload.single("file"), uploadStudyMaterial);
router.get("/:className", getMaterialByClass);
router.delete("/:id", deleteMaterial);

module.exports = router;
