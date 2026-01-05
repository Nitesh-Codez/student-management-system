const db = require("../db");

// -------------------------------------------
// 1) GET all students + attendance for a date
// -------------------------------------------
exports.getStudentsList = async (req, res) => {
  try {
    let { date } = req.query;

    if (!date) {
      const today = new Date();
      date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    }

    const sql = `
      SELECT 
        s.id AS "studentId",
        s.name AS "studentName",
        s."class" AS "class",
        COALESCE(a.status, 'Absent') AS status
      FROM students s
      LEFT JOIN attendance a
        ON s.id = a.student_id AND a.date::date = $1
      WHERE s.role = 'student'
      ORDER BY s.id
    `;

    const { rows } = await db.query(sql, [date]);

    return res.json({ success: true, date, students: rows });
  } catch (error) {
    console.error("Error fetching students:", error);
    return res.status(500).json({ success: false, message: "Server error while fetching students" });
  }
};

// -------------------------------------------
// 2) MARK or UPDATE attendance
// -------------------------------------------
exports.markAttendance = async (req, res) => {
  try {
    let { date, attendance } = req.body;

    if (!date) {
      const today = new Date();
      date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    }

    if (!attendance || !Array.isArray(attendance)) attendance = [];

    for (const item of attendance) {
      if (!item.studentId || !item.status) continue;

      await db.query(
        `
        INSERT INTO attendance (student_id, date, status)
        VALUES ($1, $2, $3)
        ON CONFLICT (student_id, date)
        DO UPDATE SET status = EXCLUDED.status
        `,
        [item.studentId, date, item.status]
      );
    }

    return res.json({ success: true, message: "Attendance saved successfully!" });
  } catch (error) {
    console.error("Error saving attendance:", error);
    return res.status(500).json({ success: false, message: "Server error while saving attendance" });
  }
};

// --------------------------------------------------
// 3) GET INDIVIDUAL STUDENT FULL ATTENDANCE HISTORY
// --------------------------------------------------
exports.getStudentAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) return res.status(400).json({ success: false, message: "Student ID required" });

    const sql = `
      SELECT date, status
      FROM attendance
      WHERE student_id = $1
      ORDER BY date DESC
    `;

    const { rows } = await db.query(sql, [id]);

    return res.json({ success: true, attendance: rows });
  } catch (error) {
    console.error("Error fetching student attendance:", error);
    return res.status(500).json({ success: false, message: "Server error while fetching records" });
  }
};

// --------------------------------------------------
// 4) GET ALL STUDENTS FULL ATTENDANCE SUMMARY (Admin)
// --------------------------------------------------
exports.getTodayAttendancePercent = async (req, res) => {
  try {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

    const sql = `
      SELECT 
        s.id AS "studentId",
        s.name AS name,
        COALESCE(SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END), 0) AS present,
        COUNT(a.date) AS total,
        (COALESCE(SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END),0) / NULLIF(COUNT(a.date),0) * 100) AS percentage
      FROM students s
      LEFT JOIN attendance a
        ON s.id = a.student_id AND a.date::date = $1
      WHERE s.role='student'
      GROUP BY s.id, s.name
      ORDER BY s.id
    `;

    const { rows } = await db.query(sql, [dateStr]);

    const result = rows.map(r => ({
      studentId: r.studentId,
      name: r.name,
      present: r.present,
      total: r.total,
      percentage: r.total > 0 ? r.percentage.toFixed(2) : "0.00"
    }));

    return res.json({ success: true, date: dateStr, students: result });
  } catch (error) {
    console.error("Error fetching today attendance percent:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// --------------------------------------------------
// 5) GET ATTENDANCE MARKS (MONTHLY)
// --------------------------------------------------
exports.getAttendanceMarks = async (req, res) => {
  try {
    const { studentId, month } = req.query;

    if (!studentId || !month) {
      return res.status(400).json({ success: false, message: "studentId & month required" });
    }

    const id = Number(studentId);
    const monthStr = month.trim(); // "2025-11"

    const sql = `
      SELECT status
      FROM attendance
      WHERE student_id = $1
      AND date::text LIKE $2
    `;

    const { rows } = await db.query(sql, [id, `${monthStr}%`]);

    const validDays = rows.filter(r => r.status === "Present" || r.status === "Absent").length;
    const presentDays = rows.filter(r => r.status === "Present").length;

    const percentage = validDays === 0 ? 0 : (presentDays / validDays) * 100;

    let marks = 0;
    if (percentage > 75) {
      marks = Math.ceil((percentage - 75) / 5);
    }

    res.json({
      success: true,
      percentage: percentage.toFixed(2),
      attendanceMarks: marks
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};
