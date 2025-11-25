const db = require("../db"); // promise-based MySQL connection

// GET: attendance by date (optional class filter)
const getAttendanceByDate = async (req, res) => {
  const { date, class: className } = req.query;
  if (!date) return res.status(400).json({ success: false, message: "Date is required" });

  try {
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

    sql += " ORDER BY s.id ASC";

    const [results] = await db.query(sql, params);

    const students = results.map(r => ({
      studentId: r.id,
      studentName: r.name,
      class: r.class,
      status: r.status || null // null if not marked
    }));

    res.json({ success: true, students });
  } catch (err) {
    console.error("DB ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST: mark or edit attendance
const markAttendance = async (req, res) => {
  const { attendance, date } = req.body;

  if (!attendance || !Array.isArray(attendance) || attendance.length === 0)
    return res.status(400).json({ success: false, message: "Attendance data is required" });

  try {
    const values = attendance.map(a => [a.studentId, date, a.status]);

    const sql = `
      INSERT INTO attendance (student_id, date, status) VALUES ?
      ON DUPLICATE KEY UPDATE status = VALUES(status)
    `;
    await db.query(sql, [values]);

    res.json({ success: true, message: "Attendance recorded successfully!" });
  } catch (err) {
    console.error("DB ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET attendance by student ID
const getAttendanceByStudent = async (req, res) => {
  const studentId = parseInt(req.params.id);
  if (!studentId) return res.status(400).json({ success: false, message: "Student ID is required" });

  try {
    const sql = `SELECT * FROM attendance WHERE student_id = ? ORDER BY date ASC`;
    const [results] = await db.query(sql, [studentId]);
    res.json({ success: true, attendance: results });
  } catch (err) {
    console.error("DB ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET all students attendance with percentage
const getAllAttendance = async (req, res) => {
  try {
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
    const [results] = await db.query(sql);

    const data = results.map(r => ({
      studentId: r.id,
      studentName: r.name,
      class: r.class,
      present: r.presentCount,
      total: r.totalCount,
      percentage: r.totalCount ? ((r.presentCount / r.totalCount) * 100).toFixed(2) : "0.00"
    }));

    res.json({ success: true, records: data });
  } catch (err) {
    console.error("DB ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAttendanceByDate,
  markAttendance,
  getAttendanceByStudent,
  getAllAttendance
};
