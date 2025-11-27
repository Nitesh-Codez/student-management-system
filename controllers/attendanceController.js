const db = require("../db");

// GET attendance by date
const getAttendanceByDate = (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ success: false, message: "Date required" });

  const sql = `
    SELECT 
      s.id, s.name, s.class,
      (SELECT a.status FROM attendance a WHERE a.student_id=s.id AND a.date=?) AS status
    FROM students s
    ORDER BY s.id
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
};

// POST: mark/update attendance
const markAttendance = (req, res) => {
  const { date, attendance } = req.body;
  if (!date || !attendance || !attendance.length) return res.status(400).json({ success: false, message: "Data required" });

  const promises = attendance.map(a => {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO attendance (student_id, date, status)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE status=VALUES(status)
      `;
      db.query(sql, [a.studentId, date, a.status], (err) => err ? reject(err) : resolve());
    });
  });

  Promise.all(promises)
    .then(() => res.json({ success: true, message: "Attendance recorded successfully!" }))
    .catch(err => res.status(500).json({ success: false, message: err.message }));
};

module.exports = { getAttendanceByDate, markAttendance };
