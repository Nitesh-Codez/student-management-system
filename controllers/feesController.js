const db = require("../db"); // promise-based pool

// Admin: Add fee record
async function addFee(req, res) {
  const { student_id, student_name, class_name, amount, payment_date, payment_time, status } = req.body;
  if (!student_id || !amount || !payment_date || !payment_time || !student_name || !class_name) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  try {
    const sql = `INSERT INTO fees 
      (student_id, student_name, class_name, amount, payment_date, payment_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)`;

    const [result] = await db.query(sql, [
      student_id, student_name, class_name, amount, payment_date, payment_time, status || "On Time"
    ]);

    res.json({ success: true, message: "Fee record added successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Admin: Update fee record
async function updateFee(req, res) {
  const feeId = req.params.id;
  const { student_id, student_name, class_name, amount, payment_date, payment_time, status } = req.body;
  if (!student_id || !amount || !payment_date || !payment_time || !student_name || !class_name) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  try {
    const sql = `UPDATE fees 
      SET student_id = ?, student_name = ?, class_name = ?, amount = ?, payment_date = ?, payment_time = ?, status = ? 
      WHERE id = ?`;

    const [result] = await db.query(sql, [
      student_id, student_name, class_name, amount, payment_date, payment_time, status, feeId
    ]);

    res.json({ success: true, message: "Fee record updated successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Admin: Delete fee record
async function deleteFee(req, res) {
  const feeId = req.params.id;
  try {
    const sql = `DELETE FROM fees WHERE id = ?`;
    const [result] = await db.query(sql, [feeId]);

    res.json({ success: true, message: "Fee record deleted successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Student: Get their fees
async function getStudentFees(req, res) {
  const studentId = req.params.id;
  try {
    const sql = `SELECT * FROM fees WHERE student_id = ? ORDER BY payment_date DESC`;
    const [results] = await db.query(sql, [studentId]);
    res.json({ success: true, fees: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Admin: Get all fees
async function getAllFees(req, res) {
  try {
    const sql = `SELECT * FROM fees ORDER BY payment_date DESC`;
    const [results] = await db.query(sql);
    res.json({ success: true, fees: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { addFee, updateFee, deleteFee, getStudentFees, getAllFees };
