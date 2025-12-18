const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "private_uploads/students");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, req.body.studentId + ext); // eg: 123.jpg
  },
});

const upload = multer({ storage });

router.post("/student-photo", upload.single("photo"), (req, res) => {
  res.json({ message: "Photo uploaded successfully" });
});

module.exports = router;
