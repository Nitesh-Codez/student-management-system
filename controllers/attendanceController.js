const db = require("../db");

// -------------------------------------------
// 1) GET all students + attendance for a date
// -------------------------------------------
exports.getStudentsList = async (req, res) => {
  try {
    let { date } = req.query;

    // Default → today's date
    if (!date) {
      const today = new Date();
      date =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0");
    }

    const sql = `
      SELECT 
        s.id AS studentId,
        s.name AS studentName,
        s.class AS class,
        COALESCE(a.status, "Absent") AS status
      FROM students s
      LEFT JOIN attendance a
        ON s.id = a.student_id AND a.date = ?
      WHERE s.role = 'student'
      ORDER BY s.id
    `;

    const [rows] = await db.query(sql, [date]);

    return res.json({
      success: true,
      date,
      students: rows,
    });

  } catch (error) {
    console.error("Error fetching students:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error while fetching students" });
  }
};

// -------------------------------------------
// 2) MARK or UPDATE attendance
// -------------------------------------------
exports.markAttendance = async (req, res) => {
  try {
    let { date, attendance } = req.body;

    // Default → today's date
    if (!date) {
      const today = new Date();
      date =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0");
    }

    if (!attendance || !Array.isArray(attendance)) {
      attendance = [];
    }

    for (const item of attendance) {
      if (!item.studentId || !item.status) continue;

      await db.query(
        `
        INSERT INTO attendance (student_id, date, status)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE status = VALUES(status)
        `,
        [item.studentId, date, item.status]
      );
    }

    return res.json({
      success: true,
      message: "Attendance saved successfully!",
    });

  } catch (error) {
    console.error("Error saving attendance:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error while saving attendance" });
  }
};

// --------------------------------------------------
// 3) GET INDIVIDUAL STUDENT FULL ATTENDANCE HISTORY
// --------------------------------------------------
exports.getStudentAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id)
      return res.status(400).json({ success: false, message: "Student ID required" });

    const sql = `
      SELECT 
        date,
        status
      FROM attendance
      WHERE student_id = ?
      ORDER BY date DESC
    `;

    const [rows] = await db.query(sql, [id]);

    return res.json({
      success: true,
      attendance: rows,
    });

  } catch (error) {
    console.error("Error fetching student attendance:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error while fetching records" });
  }
};
