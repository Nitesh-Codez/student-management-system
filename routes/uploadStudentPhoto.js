const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mysql = require("mysql2/promise");

const router = express.Router();

// MySQL connection
const pool = mysql.createPool({
  host: "crossover.proxy.rlwy.net",
  user: "your_mysql_user",
  password: "your_mysql_password",
  database: "your_db_name",
  port: 58959,
  ssl: true,
});

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
router.post("/student-photo", upload.single("photo"), async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!req.file || !studentId)
      return res.status(400).json({ error: "Photo or studentId missing" });

    const photoUrl = `/private_uploads/students/${req.file.filename}`;

    // Update MySQL students table
    const sql = "UPDATE students SET photo = ? WHERE id = ?";
    await pool.query(sql, [photoUrl, studentId]);

    res.json({ photoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
