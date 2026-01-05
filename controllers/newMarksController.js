const db = require("../db"); // Promise-based PostgreSQL DB

// ===============================
// Get unique classes
// ===============================
exports.getClasses = async (req, res) => {
  try {
    const sql = `SELECT DISTINCT "class" FROM students ORDER BY "class"`;
    const { rows } = await db.query(sql);
    res.json({ success: true, classes: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error getting classes" });
  }
};

// ===============================
// Get students by class
// ===============================
exports.getStudentsByClass = async (req, res) => {
  try {
    const { className } = req.params;
    const sql = `SELECT id, name FROM students WHERE "class" = $1`;
    const { rows } = await db.query(sql, [className]);
    res.json({ success: true, students: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error getting students" });
  }
};

// ===============================
// Add marks (NO DUPLICATE)
// ===============================
exports.addMarks = async (req, res) => {
  try {
    const {
      studentId,
      subject,
      theoryMarks,
      vivaMarks,
      attendanceMarks,
      totalMarks,
      date
    } = req.body;

    if (
      !studentId ||
      !subject ||
      theoryMarks == null ||
      vivaMarks == null ||
      attendanceMarks == null ||
      totalMarks == null ||
      !date
    ) {
      return res.json({ success: false, message: "All fields are required" });
    }

    const obtainedMarks =
      Number(theoryMarks) +
      Number(vivaMarks) +
      Number(attendanceMarks);

    const sql = `
      INSERT INTO marks_new
      (student_id, subject, theory_marks, viva_marks, attendance_marks, total_marks, obtained_marks, test_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await db.query(sql, [
      studentId,
      subject,
      theoryMarks,
      vivaMarks,
      attendanceMarks,
      totalMarks,
      obtainedMarks,
      date
    ]);

    res.json({ success: true, message: "Marks added successfully" });

  } catch (err) {
    // 🔴 PostgreSQL duplicate entry error code
    if (err.code === "23505") {
      return res.json({
        success: false,
        message: "Marks already added for this student, subject and date"
      });
    }

    console.error(err);
    res.json({ success: false, message: "Server error while adding marks" });
  }
};

// ===============================
// Check marks (Student Panel)
// ===============================
exports.checkMarks = async (req, res) => {
  try {
    const { studentId, studentName } = req.body;

    if (!studentId || !studentName) {
      return res.json({ success: false, message: "Student ID and Name required" });
    }

    // ✅ Verify student
    const sqlStudent = `SELECT id FROM students WHERE id = $1 AND name = $2`;
    const { rows: studentRows } = await db.query(sqlStudent, [studentId, studentName]);

    if (studentRows.length === 0) {
      return res.json({ success: false, message: "Invalid Student ID or Name" });
    }

    // ✅ Fetch marks
    const sqlMarks = `
      SELECT 
        subject,
        theory_marks,
        viva_marks,
        attendance_marks,
        total_marks,
        obtained_marks,
        test_date,
        status
      FROM marks_new
      WHERE student_id = $1
      ORDER BY test_date DESC
    `;
    const { rows } = await db.query(sqlMarks, [studentId]);

    if (rows.length === 0) {
      return res.json({ success: false, message: "No marks found" });
    }

    res.json({ success: true, data: rows });

  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching marks" });
  }
};
