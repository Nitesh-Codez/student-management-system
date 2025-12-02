const db = require("../db");

exports.getStudentProfile = (req, res) => {
  const { id } = req.params;

  const sql = "SELECT * FROM students WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "DB Error" });
    if (result.length === 0)
      return res.status(404).json({ success: false, message: "Student not found" });

    res.json({ success: true, data: result[0] });
  });
};

exports.getProfileByPassword = (req, res) => {
  const { password } = req.body;

  const sql = "SELECT * FROM students WHERE password = ?";
  db.query(sql, [password], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "DB Error" });
    if (result.length === 0)
      return res.status(404).json({ success: false, message: "Invalid password" });

    res.json({ success: true, data: result[0] });
  });
};
