const db = require("../db");

// GET students + attendance for a date
exports.getStudentsList = async (req, res) => {
  try {
    // Agar date na mile, default today ki date set karo
    let { date } = req.query;
    if (!date) {
      const today = new Date();
      date =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0");
    }

    // Fetch all students and their attendance for the given date
    const sql = `
      SELECT 
        s.id AS studentId,
        s.name AS studentName,
        s.class AS class,
        COALESCE(a.status, "Absent") AS status
      FROM students s
      LEFT JOIN attendance a
        ON s.id = a.student_id AND a.date = ?
      ORDER BY s.id
    `;

    const [rows] = await db.query(sql, [date]);

    return res.json({
      success: true,
      date: date,
      students: rows,
    });

  } catch (error) {
    console.error("Error fetching students:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// MARK or UPDATE Attendance
exports.markAttendance = async (req, res) => {
  try {
    let { date, attendance } = req.body;

    // Default date = today if not provided
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
      attendance = []; // empty array if nothing sent
    }

    for (const item of attendance) {
      if (!item.studentId || !item.status) continue; // skip invalid items

      await db.query(
        `
        INSERT INTO attendance (student_id, date, status)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE status = VALUES(status)
        `,
        [item.studentId, date, item.status]
      );
    }

    return res.json({ success: true, message: "Attendance saved!" });

  } catch (error) {
    console.error("Error saving attendance:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
