const db = require("../db");

// GET: attendance by date with default Present
function getAttendanceByDate(req, res) {
  const { date, className } = req.query;
  if (!date) return res.status(400).json({ success: false, message: "Date is required" });

  let sql = `
    SELECT s.id, s.name, s.class, a.status
    FROM students s
    LEFT JOIN attendance a
    ON s.id = a.student_id AND a.date = ?
    WHERE s.role='student'
  `;
  const params = [date];

  if (className) {
    sql += ` AND s.class = ?`;
    params.push(className);
  }

  sql += ` ORDER BY s.id ASC`;

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });

    const students = results.map(r => ({
      studentId: r.id,
      studentName: r.name,
      class: r.class,
      status: r.status || null // keep null if not marked today
    }));

    res.json({ success: true, students });
  });
}

// NEW: Get attendance status for today
function getTodayAttendanceStatus(req, res) {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const sql = `
    SELECT student_id AS studentId, 1 AS marked
    FROM attendance
    WHERE date = ?
  `;
  db.query(sql, [today], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, attendance: results }); // array of { studentId, marked }
  });
}

// POST: mark or edit attendance
function markAttendance(req, res) {
  const { attendance, date } = req.body;
  if (!attendance || !Array.isArray(attendance) || attendance.length === 0) {
    return res.status(400).json({ success: false, message: "Attendance data is required" });
  }

  const values = attendance.map(a => [a.studentId, date, a.status]);

  const sql = `
    INSERT INTO attendance (student_id, date, status) VALUES ?
    ON DUPLICATE KEY UPDATE status=VALUES(status)
  `;

  db.query(sql, [values], (err) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, message: "Attendance recorded successfully!" });
  });
}

// GET: attendance by student ID
function getAttendanceByStudent(req, res) {
  const studentId = parseInt(req.params.id);
  if (!studentId) return res.status(400).json({ success: false, message: "Student ID is required" });

  const sql = `SELECT * FROM attendance WHERE student_id = ? ORDER BY date ASC`;
  db.query(sql, [studentId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, attendance: results });
  });
}

// GET all students attendance with %
function getAllAttendance(req, res) {
  const sql = `
    SELECT s.id, s.name, s.class,
      SUM(a.status='Present') AS presentCount,
      COUNT(a.id) AS totalCount
    FROM students s
    LEFT JOIN attendance a ON s.id = a.student_id
    WHERE s.role='student'
    GROUP BY s.id
    ORDER BY s.id ASC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });

    const data = results.map(r => ({
      studentId: r.id,
      studentName: r.name,
      class: r.class,
      present: r.presentCount,
      total: r.totalCount,
      percentage: r.totalCount ? ((r.presentCount / r.totalCount) * 100).toFixed(2) : "0.00"
    }));

    res.json({ success: true, records: data });
  });
}

module.exports = { 
  getAttendanceByDate, 
  markAttendance, 
  getAttendanceByStudent,
  getAllAttendance,
  getTodayAttendanceStatus // NEW
};
