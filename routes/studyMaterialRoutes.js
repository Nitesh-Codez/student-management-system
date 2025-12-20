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
      __dirname,
      "..",
      "uploads",
      "study-material",
      `class-${req.body.class_name}`
    );

    // Folder create if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log("Created folder:", uploadPath);
    }

    console.log("Saving file in:", uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Use original filename
    cb(null, file.originalname);
    console.log("Filename to save:", file.originalname);
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
router.get("/download/:id", downloadMaterial); // 🔥 DOWNLOAD
router.get("/:className", getMaterialByClass);
router.delete("/:id", deleteMaterial);

// ================= TEMP TEST ROUTE =================
// Optional: check uploaded files on Render server
router.get("/test-files/:className", (req, res) => {
  const folder = path.join(
    __dirname,
    "..",
    "uploads",
    "study-material",
    `class-${req.params.className}`
  );

  if (!fs.existsSync(folder)) return res.send("Folder not found");
  const files = fs.readdirSync(folder);
  res.json(files);
});

module.exports = router;
