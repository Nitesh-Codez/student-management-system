const db = require("../db");

// -----------------------------
// Get profile by ID from frontend (stored in localStorage)
// -----------------------------
exports.getProfileById = (req, res) => {
  const { id } = req.body;

  if (!id)
    return res.status(400).json({ success: false, message: "Student ID required" });

  const sql = "SELECT * FROM students WHERE id = ? LIMIT 1";

  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "DB error", err });

    if (result.length === 0)
      return res.status(404).json({ success: false, message: "Student not found" });

    res.json({ success: true, data: result[0] });
  });
};
