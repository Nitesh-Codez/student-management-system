const fs = require("fs");
const path = require("path");
const multer = require("multer");

// JSON file to store student data
const studentsFile = path.join(__dirname, "..", "data", "students.json");

// ================= MULTER =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join("private_uploads", "students");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, req.body.studentId + ext); // ID ke naam se save
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only images allowed"));
    cb(null, true);
  },
});

// ================= CONTROLLER =================
async function uploadStudentPhoto(req, res) {
  const { studentId } = req.body;

  if (!studentId || !req.file) {
    return res.status(400).json({
      success: false,
      message: "Student ID and photo are required",
    });
  }

  try {
    const photoUrl = `/private_uploads/students/${req.file.filename}`;

    // Load existing students
    let students = [];
    if (fs.existsSync(studentsFile)) {
      students = JSON.parse(fs.readFileSync(studentsFile));
    }

    // Update or add student
    const index = students.findIndex(s => s.id == studentId);
    if (index >= 0) {
      students[index].photo = photoUrl;
    } else {
      students.push({ id: studentId, photo: photoUrl });
    }

    // Save back to JSON
    fs.writeFileSync(studentsFile, JSON.stringify(students, null, 2));

    res.json({ success: true, message: "Photo uploaded successfully", photoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { upload, uploadStudentPhoto };
