const bcrypt = require("bcryptjs");
const db = require("../db"); // Promise-based MySQL connection

// Get all students
exports.getStudents = async (req, res) => {
  try {
    const [results] = await db.query(
      "SELECT id, name, `class`, mobile, address FROM students WHERE role='student'"
    );
    res.json({ success: true, students: results });
  } catch (err) {
    console.log("DB ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Add student
exports.addStudent = async (req, res) => {
  const { name, class: studentClass, password, mobile = null, address = null } = req.body;

  if (!name || !studentClass || !password)
    return res.json({ success: false, message: "Name, class and password are required" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      "INSERT INTO students (name, `class`, password, mobile, address, role) VALUES (?, ?, ?, ?, ?, 'student')",
      [name, studentClass, hashedPassword, mobile, address]
    );

    res.json({ success: true, message: "Student added successfully" });
  } catch (err) {
    console.log("DB ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete student
exports.deleteStudent = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query("DELETE FROM students WHERE id = ?", [id]);
    res.json({ success: true, message: "Student deleted successfully" });
  } catch (err) {
    console.log("DB ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
