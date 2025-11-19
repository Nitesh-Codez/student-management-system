const mysql = require("mysql2");
const bcrypt = require("bcryptjs");

// DB connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "nitesh123@",
  database: "tuition_db",
});

db.connect((err) => {
  if (err) console.log("DB Connection Error:", err);
  else console.log("✅ MySQL Connected Successfully!");
});

// Get all students
exports.getStudents = (req, res) => {
  db.query(
    "SELECT id, name, class, mobile, address FROM students WHERE role='student'",
    (err, results) => {
      if (err) return res.json({ success: false, message: err.message });
      res.json({ success: true, students: results });
    }
  );
};

// Add student
exports.addStudent = (req, res) => {
  const { name, class: studentClass, password, mobile, address } = req.body;

  if (!name || !studentClass || !password || !mobile || !address)
    return res.json({ success: false, message: "All fields are required" });

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.query(
    "INSERT INTO students (name, class, password, mobile, address, role) VALUES (?, ?, ?, ?, ?, 'student')",
    [name, studentClass, hashedPassword, mobile, address],
    (err, result) => {
      if (err) return res.json({ success: false, message: err.message });
      res.json({ success: true, message: "Student added successfully" });
    }
  );
};

// Delete student
exports.deleteStudent = (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM students WHERE id = ?", [id], (err, result) => {
    if (err) return res.json({ success: false, message: err.message });
    res.json({ success: true, message: "Student deleted successfully" });
  });
};
