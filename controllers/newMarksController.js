const db = require("../db"); // Promise-based PostgreSQL DB

// ===============================
// Get unique classes
// ===============================
exports.getClasses = async (req, res) => {
  try {
    const sql = `SELECT DISTINCT "class" FROM students ORDER BY "class"`;
    const { rows } = await db.query(sql);

    res.json({
      success: true,
      classes: rows
    });

  } catch (err) {
    console.error(err);

    res.json({
      success: false,
      message: "Error getting classes"
    });
  }
};


// ===============================
// Get students by class
// ===============================
exports.getStudentsByClass = async (req, res) => {
  try {
    const { className } = req.params;

    const sql = `
      SELECT id, name
      FROM students
      WHERE "class" = $1
    `;

    const { rows } = await db.query(sql, [className]);

    res.json({
      success: true,
      students: rows
    });

  } catch (err) {
    console.error(err);

    res.json({
      success: false,
      message: "Error getting students"
    });
  }
};

// ===============================
// Add marks (NO DUPLICATE)
// ===============================
// ===============================
// Add / Replace Marks
// ===============================
exports.addMarks = async (req, res) => {
  try {

    const {
      studentId,
      subject,
      theoryMarks,
      vivaMarks,
      attendanceMarks,
      task,
      totalMarks,
      examType,
      session,
      date,
      behaviour
    } = req.body;


    // ===============================
    // Validate Required Fields
    // ===============================
    if (
      !studentId ||
      !subject ||
      theoryMarks == null ||
      vivaMarks == null ||
      attendanceMarks == null ||
      task == null ||
      totalMarks == null ||
      !examType ||
      !session ||
      !date ||
      behaviour == null
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }


    // ===============================
    // Calculate Obtained Marks
    // ===============================
    const obtainedMarks =
      Number(theoryMarks) +
      Number(vivaMarks) +
      Number(attendanceMarks) +
      Number(task) +
      Number(behaviour);


    // ===============================
    // INSERT OR UPDATE
    // ===============================
    const sql = `
      INSERT INTO marks_new
      (
        student_id,
        subject,
        theory_marks,
        viva_marks,
        attendance_marks,
        task,
        total_marks,
        obtained_marks,
        exam_type,
        session,
        test_date,
        behaviour
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12
      )

      ON CONFLICT (
        student_id,
        subject,
        test_date,
        exam_type,
        session
      )

      DO UPDATE SET
        theory_marks = EXCLUDED.theory_marks,
        viva_marks = EXCLUDED.viva_marks,
        attendance_marks = EXCLUDED.attendance_marks,
        task = EXCLUDED.task,
        total_marks = EXCLUDED.total_marks,
        obtained_marks = EXCLUDED.obtained_marks,
        behaviour = EXCLUDED.behaviour

      RETURNING *;
    `;


    const { rows } = await db.query(sql, [
      studentId,
      subject,
      theoryMarks,
      vivaMarks,
      attendanceMarks,
      task,
      totalMarks,
      obtainedMarks,
      examType,
      session,
      date,
      behaviour
    ]);


    return res.json({
      success: true,
      message: "Marks added/updated successfully",
      data: rows[0]
    });


  } catch (error) {

    console.error("Add/Update marks error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while adding/updating marks"
    });
  }
};

//==============================
// Check marks (Student Panel)
// ===============================
exports.checkMarks = async (req, res) => {
  try {

    const {
      studentId,
      studentName
    } = req.body;


    // ===============================
    // Validate Student
    // ===============================
    if (!studentId || !studentName) {
      return res.json({
        success: false,
        message: "Student ID and Name required"
      });
    }


    // ===============================
    // Verify Student
    // ===============================
    const sqlStudent = `
      SELECT id
      FROM students
      WHERE id = $1
      AND name = $2
    `;


    const {
      rows: studentRows
    } = await db.query(
      sqlStudent,
      [
        studentId,
        studentName
      ]
    );


    if (studentRows.length === 0) {
      return res.json({
        success: false,
        message: "Invalid Student ID or Name"
      });
    }


    // ===============================
    // Fetch Marks
    // ===============================
    const sqlMarks = `
      SELECT
        subject,
        theory_marks,
        viva_marks,
        attendance_marks,
        task,
        total_marks,
        obtained_marks,
        exam_type,
        session,
        test_date,
        status,
        behaviour
      FROM marks_new
      WHERE student_id = $1
      ORDER BY test_date DESC
    `;


    const {
      rows
    } = await db.query(
      sqlMarks,
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


// ==================================================
// Get Current Attendance Marks
// ==================================================
exports.getCurrentAttendanceMarks = async (req, res) => {
  try {

    const {
      studentId
    } = req.query;


    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "studentId required"
      });
    }


    const today = new Date();


    // ===============================
    // Current Session Year
    // ===============================
    const sessionYear =
      today.getMonth() + 1 >= 4
        ? today.getFullYear()
        : today.getFullYear() - 1;


    const startDate =
      `${sessionYear}-04-01`;


    const endDate =
      today.toISOString().split("T")[0];


    const {
      rows
    } = await db.query(
      `
        SELECT
          EXTRACT(MONTH FROM date)::int AS month,
          status
        FROM attendance
        WHERE student_id = $1
        AND date BETWEEN $2 AND $3
      `,
      [
        studentId,
        startDate,
        endDate
      ]
    );


    let totalMarks = 0;
    let totalMonths = 0;


    // ===============================
    // April → Current Month
    // ===============================
    const lastMonth =
      today.getFullYear() === sessionYear
        ? today.getMonth() + 1
        : 12;


    for (
      let month = 4;
      month <= lastMonth;
      month++
    ) {

      const monthData =
        rows.filter(
          r => r.month === month
        );


      if (monthData.length === 0) {
        continue;
      }


      // ===============================
      // Valid Attendance Days
      // ===============================
      const validDays =
        monthData.filter(
          r =>
            r.status === "Present" ||
            r.status === "Absent"
        ).length;


      // ===============================
      // Present Days
      // ===============================
      const presentDays =
        monthData.filter(
          r =>
            r.status === "Present"
        ).length;


      // ===============================
      // Percentage
      // ===============================
      const percentage =
        validDays === 0
          ? 0
          : (presentDays / validDays) * 100;


      // ===============================
      // Attendance Marks
      // ===============================
      const marks =
        percentage <= 75
          ? 0
          : Math.ceil(
              (percentage - 75) / 5
            );


      totalMarks += marks;
      totalMonths++;
    }


    // ===============================
    // Final Attendance Marks
    // ===============================
    const attendanceMarks =
      totalMonths === 0
        ? 0
        : Number(
            (
              totalMarks /
              totalMonths
            ).toFixed(2)
          );


    return res.json({
      success: true,
      attendanceMarks
    });


  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};


// ==================================================
// Get Marks By Selected Date
// ==================================================
exports.getMarksByDate = async (req, res) => {
  try {

    const {
      date
    } = req.query;


    // ===============================
    // Validate Date
    // ===============================
    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required"
      });
    }


    // ===============================
    // Fetch Marks For Selected Date
    // ===============================
    const sql = `
      SELECT
        m.id,
        m.student_id,
        s.name AS student_name,
        s."class" AS class_name,

        m.subject,

        m.theory_marks,
        m.viva_marks,
        m.attendance_marks,
        m.task,

        m.total_marks,
        m.obtained_marks,

        m.exam_type,
        m.session,

        m.test_date,
        m.status,

        m.behaviour

      FROM marks_new m

      LEFT JOIN students s
        ON s.id = m.student_id

      WHERE m.test_date = $1

      ORDER BY
        s."class",
        s.name,
        m.subject
    `;


    const {
      rows
    } = await db.query(
      sql,
      [date]
    );


    // ===============================
    // Response
    // ===============================
    return res.json({
      success: true,
      date,
      total: rows.length,
      data: rows
    });


  } catch (error) {

    console.error(
      "Get marks by date error:",
      error
    );


    return res.status(500).json({
      success: false,
      message: "Error fetching marks by date"
    });
  }
};


//
// ==================================================
// Edit / Update Marks
// ==================================================
exports.updateMarks = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      theoryMarks,
      vivaMarks,
      attendanceMarks,
      task,
      totalMarks,
      behaviour,
      examType,
      session,
      date
    } = req.body;

    // ===============================
    // Validate
    // ===============================
    if (
      !id ||
      theoryMarks == null ||
      vivaMarks == null ||
      attendanceMarks == null ||
      task == null ||
      totalMarks == null ||
      behaviour == null ||
      !examType ||
      !session ||
      !date
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // ===============================
    // Calculate Obtained Marks
    // ===============================
    const obtainedMarks =
      Number(theoryMarks) +
      Number(vivaMarks) +
      Number(attendanceMarks) +
      Number(task) +
      Number(behaviour);

    // ===============================
    // Update Marks
    // ===============================
    const sql = `
      UPDATE marks_new
      SET
        theory_marks = $1,
        viva_marks = $2,
        attendance_marks = $3,
        task = $4,
        total_marks = $5,
        obtained_marks = $6,
        exam_type = $7,
        session = $8,
        test_date = $9,
        behaviour = $10
      WHERE id = $11
      RETURNING *
    `;

    const { rows } = await db.query(sql, [
      theoryMarks,
      vivaMarks,
      attendanceMarks,
      task,
      totalMarks,
      obtainedMarks,
      examType,
      session,
      date,
      behaviour,
      id
    ]);

    // ===============================
    // Marks Not Found
    // ===============================
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Marks record not found"
      });
    }

    return res.json({
      success: true,
      message: "Marks updated successfully",
      data: rows[0]
    });

  } catch (error) {
    console.error("Update marks error:", error);

    return res.status(500).json({
      success: false,
      message: "Error updating marks"
    });
  }
};

//current session marks for already alloted marks
//================ADMIN==============================
// ==================================================
// Get Current Session All Subjects
// ==================================================
// ==================================================
exports.getCurrentSessionMarks = async (req, res) => {
  try {

    const today = new Date();

    // ===============================
    // Current Academic Session
    // April → March
    // ===============================
    const startYear =
      today.getMonth() + 1 >= 4
        ? today.getFullYear()
        : today.getFullYear() - 1;

    const currentSession =
      `${startYear}-${String(startYear + 1).slice(-2)}`;


    // ===============================
    // Fetch Full Current Session Data
    // ===============================
    const sql = `
      SELECT
        m.id,
        m.student_id,

        s.name AS student_name,
        s."class" AS class_name,

        m.subject,

        m.theory_marks,
        m.viva_marks,
        m.attendance_marks,
        m.task,
        m.behaviour,

        m.total_marks,
        m.obtained_marks,
        m.status,

        m.test_date,
        m.exam_type,
        m.session

      FROM marks_new m

      LEFT JOIN students s
        ON s.id = m.student_id

      WHERE m.session = $1

      ORDER BY
        m.test_date DESC,
        s."class" ASC,
        s.name ASC,
        m.subject ASC
    `;


    const { rows } = await db.query(
      sql,
      [currentSession]
    );


    // ===============================
    // Response
    // ===============================
    return res.json({
      success: true,
      session: currentSession,
      total: rows.length,
      data: rows
    });


  } catch (error) {

    console.error(
      "Get current session marks error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Error fetching current session marks"
    });
  }
};


//=======================
//STUDENT INTERNAL MARKS
//============================================
exports.getStudentCurrentSessionMarks = async (req, res) => {
  try {

    const { studentId } = req.params;

    // ===============================
    // Validate Student ID
    // ===============================
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required"
      });
    }


    // ===============================
    // Current Academic Session
    // April → March
    // ===============================
    const today = new Date();

    const startYear =
      today.getMonth() + 1 >= 4
        ? today.getFullYear()
        : today.getFullYear() - 1;

    const currentSession =
      `${startYear}-${String(startYear + 1).slice(-2)}`;


    // ===============================
    // Fetch Student Current Session Marks
    // ===============================
    const sql = `
      SELECT
        m.id,
        m.student_id,

        s.name AS student_name,
        s."class" AS class_name,

        m.subject,

        m.viva_marks,
        m.attendance_marks,
        m.task,
        m.behaviour,

        m.total_marks,
        m.obtained_marks,
        m.status,

        m.exam_type,
        m.session

      FROM marks_new m

      LEFT JOIN students s
        ON s.id = m.student_id

      WHERE m.student_id = $1
      AND m.session = $2

      ORDER BY
        m.exam_type ASC,
        m.subject ASC
    `;


    const { rows } = await db.query(
      sql,
      [
        studentId,
        currentSession
      ]
    );


    // ===============================
    // No Marks
    // ===============================
    if (rows.length === 0) {
      return res.json({
        success: true,
        session: currentSession,
        total: 0,
        data: [],
        message: "No marks found for current session"
      });
    }


    // ===============================
    // Response
    // ===============================
    return res.json({
      success: true,
      session: currentSession,
      total: rows.length,
      data: rows
    });


  } catch (error) {

    console.error(
      "Get student current session marks error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Error fetching student marks"
    });
  }
};