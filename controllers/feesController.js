const db = require("../db");
db.connect(err => {
  if (err) console.log("DB Connection Error:", err);
  else console.log("✅ MySQL Connected Successfully!");
});

// Admin: Add fee record
function addFee(req, res) {
  const { student_id, student_name, class_name, amount, payment_date, payment_time, status } = req.body;
  if (!student_id || !amount || !payment_date || !payment_time || !student_name || !class_name) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  const sql = `INSERT INTO fees (student_id, student_name, class, amount, payment_date, payment_time, status)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;

  db.query(sql, [student_id, student_name, class_name, amount, payment_date, payment_time, status || "On Time"], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, message: "Fee record added successfully!" });
  });
}

// Student: Get their fees
function getStudentFees(req, res) {
  const studentId = req.params.id;
  const sql = `SELECT * FROM fees WHERE student_id = ? ORDER BY payment_date DESC`;
  db.query(sql, [studentId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, fees: results });
  });
}

// Admin: Get all fees
function getAllFees(req, res) {
  const sql = `SELECT * FROM fees ORDER BY payment_date DESC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, fees: results });
  });
}

module.exports = { addFee, getStudentFees, getAllFees };
