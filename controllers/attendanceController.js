const db = require("../db");

// GET: attendance by date
function getAttendanceByDate(req, res) {
  const { date } = req.query;
  if (!date) return res.status(400).json({ success: false, message: "Date is required" });

  const sql = `
    SELECT s.id, s.name, s.class, a.status
    FROM students s
    LEFT JOIN attendance a
    ON s.id = a.student_id AND a.date = ?
    WHERE s.role='student'
    ORDER BY s.id ASC
  `;

  db.query(sql, [date], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });

    const students = results.map(r => ({
      studentId: r.id,
      studentName: r.name,
      class: r.class,
      status: r.status || null
    }));

    res.json({ success: true, students });
  });
}

// POST: mark attendance
function markAttendance(req, res) {
  const { attendance, date } = req.body;
  if (!attendance || !Array.isArray(attendance) || attendance.length === 0)
    return res.status(400).json({ success: false, message: "Attendance data is required" });

  const values = attendance.map(a => [a.studentId, date, a.status]);

  const sql = `
    INSERT INTO attendance (student_id, date, status) VALUES ?
    ON DUPLICATE KEY UPDATE status=VALUES(status)
  `;

  db.query(sql, [values], err => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, message: "Attendance recorded successfully!" });
  });
}

// GET attendance by student ID
function getAttendanceByStudent(req, res) {
  const studentId = parseInt(req.params.id);
  if (!studentId) return res.status(400).json({ success: false, message: "Student ID is required" });

  const sql = `SELECT * FROM attendance WHERE student_id = ? ORDER BY date ASC`;
  db.query(sql, [studentId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, attendance: results });
  });
}

// GET all attendance %
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

    const records = results.map(r => ({
      studentId: r.id,
      studentName: r.name,
      class: r.class,
      present: r.presentCount,
      total: r.totalCount,
      percentage: r.totalCount ? ((r.presentCount / r.totalCount) * 100).toFixed(2) : "0.00"
    }));

    res.json({ success: true, records });
  });
}

module.exports = {
  getAttendanceByDate,
  markAttendance,
  getAttendanceByStudent,
  getAllAttendance
};
