const db = require("../db"); // Promise-based DB

// Get unique classes from students table
exports.getClasses = async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT DISTINCT class FROM students ORDER BY class"
    );
    res.json({ success: true, classes: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error getting classes" });
  }
};

// Get students list by class
exports.getStudentsByClass = async (req, res) => {
  try {
    const { className } = req.params;

    const [rows] = await db.execute(
      "SELECT id, name FROM students WHERE class = ?",
      [className]
    );

    res.json({ success: true, students: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error getting students" });
  }
};

// Add marks
exports.addMarks = async (req, res) => {
  try {
    const { studentId, subject, marks, maxMarks, date } = req.body;

    if (!studentId || !subject || !marks || !maxMarks || !date) {
      return res.json({ success: false, message: "Missing fields" });
    }

    await db.execute(
      "INSERT INTO marks (student_id, subject, total_marks, obtained_marks, test_date) VALUES (?, ?, ?, ?, ?)",
      [studentId, subject, maxMarks, marks, date]
    );

    res.json({ success: true, message: "Marks added successfully" });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error adding marks" });
  }
};
// Check marks by student ID
exports.checkMarks = async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.json({ success: false, message: "Student ID required" });
    }

    const [rows] = await db.execute(
      "SELECT id, subject AS subject_name, total_marks, obtained_marks, test_date, \
      CASE WHEN obtained_marks >= total_marks * 0.33 THEN 'Pass' ELSE 'Fail' END AS status \
      FROM marks WHERE student_id = ? ORDER BY test_date DESC",
      [studentId]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: "No marks found!" });
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching marks" });
  }
};
