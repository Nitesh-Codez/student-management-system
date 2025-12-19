const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db"); // ✅ yahan import

// Create folder if not exists
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

// POST route for student photo
router.post("/student-photo", upload.single("photo"), async (req, res) => {
  const { studentId } = req.body;
  if (!req.file || !studentId) {
    return res.status(400).json({ error: "Photo or studentId missing" });
  }

  const photoUrl = `/private_uploads/students/${req.file.filename}`;

  try {
    // Update DB
    await db.query("UPDATE students SET photo = ? WHERE id = ?", [photoUrl, studentId]);
    res.json({ photoUrl });
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
