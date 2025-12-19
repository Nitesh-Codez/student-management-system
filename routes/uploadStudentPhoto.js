const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Upload folder
const uploadDir = path.join(__dirname, "../private_uploads/students");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const studentId = req.body.studentId;
    const ext = path.extname(file.originalname);
    cb(null, `${studentId}${ext}`);
  },
});
const upload = multer({ storage });

// POST route
router.post("/student-photo", upload.single("photo"), (req, res) => {
  if (!req.file || !req.body.studentId)
    return res.status(400).json({ error: "Photo or studentId missing" });

  const photoUrl = `/private_uploads/students/${req.file.filename}`;
  // Update DB if needed
  res.json({ photoUrl });
});

module.exports = router;
