const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db"); // MySQL connection

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../private_uploads/students");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    if (!req.body.studentId) return cb(new Error("studentId missing"));
    const ext = path.extname(file.originalname);
    cb(null, req.body.studentId + ext);
  },
});

const upload = multer({ storage });

router.post("/student-photo", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) throw new Error("File upload failed");

    const photoUrl = `/private_uploads/students/${req.file.filename}`;

    // DB update
    const sql = "UPDATE students SET photo = ? WHERE id = ?";
    db.query(sql, [photoUrl, req.body.studentId], (err, result) => {
      if (err) throw err;
      res.json({ message: "Photo uploaded successfully", photoUrl });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
