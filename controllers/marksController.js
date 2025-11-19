const db = require("../db");

// GET classes
function getClasses(req, res) {
  const sql = "SELECT DISTINCT class FROM students ORDER BY class";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, classes: results.map(r => r.class) });
  });
}

// GET students by class
function getStudentsByClass(req, res) {
  const className = req.params.className;
  const sql = "SELECT id, name FROM students WHERE class = ?";
  db.query(sql, [className], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, students: results });
  });
}

// POST add marks
function addMarks(req, res) {
  const { studentId, subject, marks, maxMarks, date, remark } = req.body;
  if (!studentId || !subject || marks == null || maxMarks == null || !date) {
    return res.status(400).json({ success: false, message: "All fields required" });
  }
  const sql = "INSERT INTO marks (student_id, subject, marks, max_marks, date, remark) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(sql, [studentId, subject, marks, maxMarks, date, remark || ""], (err) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, message: "Marks added successfully" });
  });
}

// GET subjects list (normalized)
function getSubjects(req, res) {
  const sql = "SELECT DISTINCT subject FROM marks ORDER BY subject";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });

    const subjects = results.map(r => {
      let s = r.subject.trim().toLowerCase();
      return s.charAt(0).toUpperCase() + s.slice(1);
    });

    res.json({ success: true, subjects });
  });
}

// GET marks by student + subject
function getMarksByStudent(req, res) {
  const { id, subject } = req.params;
  if (!id || !subject) return res.status(400).json({ success: false, message: "Student ID or Subject missing" });

  const sql = "SELECT subject, marks, max_marks, date, remark FROM marks WHERE student_id = ? AND LOWER(subject) = LOWER(?) ORDER BY id DESC LIMIT 1";

  db.query(sql, [id, subject], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!results.length) return res.json({ success: false, message: "Marks not found" });

    const row = results[0];
    res.json({
      success: true,
      subject: row.subject,
      marks: row.marks,
      maxMarks: row.max_marks,
      date: row.date,
      remark: row.remark,
    });
  });
}

module.exports = {
  getClasses,
  getStudentsByClass,
  addMarks,
  getSubjects,
  getMarksByStudent,
};
