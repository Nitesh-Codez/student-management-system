const db = require("../db"); // Promise-based DB

// ===============================
// Get unique classes
// ===============================
exports.getClasses = async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT DISTINCT class FROM students ORDER BY class"
    );
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

    const [rows] = await db.execute(
      "SELECT id, name FROM students WHERE class = ?",
      [className]
    );

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

    // ✅ Validation
    if (
      !studentId ||
      !subject ||
      theoryMarks == null ||
      vivaMarks == null ||
      attendanceMarks == null ||
      totalMarks == null ||
      !date
    ) {
      return res.json({
        success: false,
        message: "All fields are required"
      });
    }

    const obtainedMarks =
      Number(theoryMarks) +
      Number(vivaMarks) +
      Number(attendanceMarks);

    // ✅ Insert (DB UNIQUE will block duplicates)
    await db.execute(
      `INSERT INTO marks_new
      (student_id, subject, theory_marks, viva_marks, attendance_marks, total_marks, obtained_marks, test_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        subject,
        theoryMarks,
        vivaMarks,
        attendanceMarks,
        totalMarks,
        obtainedMarks,
        date
      ]
    );

    res.json({
      success: true,
      message: "Marks added successfully"
    });

  } catch (err) {

    // 🔴 Duplicate record handling
    if (err.code === "ER_DUP_ENTRY") {
      return res.json({
        success: false,
        message:
          "Marks already added for this student, subject and date"
      });
    }

    console.error(err);
    res.json({
      success: false,
      message: "Server error while adding marks"
    });
  }
};

// ===============================
// Check marks (Student Panel)
// ===============================
exports.checkMarks = async (req, res) => {
  try {
    const { studentId, studentName } = req.body;

    if (!studentId || !studentName) {
      return res.json({
        success: false,
        message: "Student ID and Name required"
      });
    }

    // ✅ Verify student
    const [student] = await db.execute(
      "SELECT id FROM students WHERE id = ? AND name = ?",
      [studentId, studentName]
    );

    if (student.length === 0) {
      return res.json({
        success: false,
        message: "Invalid Student ID or Name"
      });
    }

    // ✅ Fetch marks
    const [rows] = await db.execute(
      `SELECT 
        subject,
        theory_marks,
        viva_marks,
        attendance_marks,
        total_marks,
        obtained_marks,
        test_date,
        status
      FROM marks_new
      WHERE student_id = ?
      ORDER BY test_date DESC`,
      [studentId]
    );

    if (rows.length === 0) {
      return res.json({
        success: false,
        message: "No marks found"
      });
    }

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error(error);
    res.json({
      success: false,
      message: "Error fetching marks"
    });
  }
};
