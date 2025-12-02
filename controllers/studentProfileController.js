const db = require("../db");

// -----------------------------
// Get Profile by Student ID
// -----------------------------
exports.getStudentProfile = (req, res) => {
  const id = req.params.id;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Student ID is required",
    });
  }

  const sql = "SELECT * FROM students WHERE id = ? LIMIT 1";

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({
        success: false,
        message: "Database error",
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.json({
      success: true,
      student: result[0],
    });
  });
};
