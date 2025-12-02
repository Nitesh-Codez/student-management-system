const db = require("../db"); // MySQL connection

exports.getProfileById = (req, res) => {
  const { id } = req.body;

  if (!id) return res.status(400).json({ success: false, message: "User ID required" });

  const sql = "SELECT * FROM students WHERE id = ? LIMIT 1";
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });

    if (results.length === 0) return res.status(404).json({ success: false, message: "Profile not found" });

    const student = results[0];
    delete student.password;
    res.json({ success: true, profile: student });
  });
};
