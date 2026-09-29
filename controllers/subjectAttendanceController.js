
const pool = require("../db");


const getStudentSubjectAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;

    // --------------------------------------------------
    // Get Student Details
    // --------------------------------------------------
    const studentQuery = `
      SELECT
        id,
        name,
        class,
        stream,
        session
      FROM students
      WHERE id = $1
    `;

    const studentResult = await pool.query(studentQuery, [studentId]);

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student = studentResult.rows[0];

    // --------------------------------------------------
    // Only 8th to 12th
    // --------------------------------------------------
    if (Number(student.class) < 8 || Number(student.class) > 12) {
      return res.status(400).json({
        success: false,
        message:
          "Subject-wise attendance is applicable only from class 8th to 12th",
      });
    }

    // --------------------------------------------------
    // Subject-wise Attendance
    // subjects table se subject_code + subject_name
    // subject_attendance se attendance
    // --------------------------------------------------
    const attendanceQuery = `
      SELECT
        s.subject_code,
        s.subject_name,

        COUNT(sa.id) AS total_classes,

        COUNT(
          CASE
            WHEN sa.status = 'Present' THEN 1
          END
        ) AS present_classes,

        COUNT(
          CASE
            WHEN sa.status = 'Absent' THEN 1
          END
        ) AS absent_classes

      FROM subjects s

      LEFT JOIN subject_attendance sa
        ON sa.subject_code = s.subject_code
        AND sa.student_id = $1

      WHERE CAST(s.class AS INTEGER) = $2

      GROUP BY
        s.subject_code,
        s.subject_name

      ORDER BY s.subject_name
    `;

    const attendanceResult = await pool.query(attendanceQuery, [
      studentId,
      student.class,
    ]);

    const subjects = attendanceResult.rows.map((row) => {
      const total = Number(row.total_classes);
      const present = Number(row.present_classes);
      const absent = Number(row.absent_classes);

      const percentage =
        total > 0
          ? Number(((present / total) * 100).toFixed(2))
          : 0;

      return {
        subject_code: row.subject_code,
        subject_name: row.subject_name,
        total_classes: total,
        present_classes: present,
        absent_classes: absent,
        percentage,
        eligible: percentage >= 75,
      };
    });

    return res.status(200).json({
      success: true,

      student: {
        id: student.id,
        name: student.name,
        class: student.class,
        stream: student.stream,
        session: student.session,
      },

      attendance: subjects,
    });
  } catch (error) {
    console.error(
      "getStudentSubjectAttendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch subject attendance",
    });
  }
};


// ======================================================
// 2. MARK SINGLE SUBJECT ATTENDANCE
// ======================================================
//
// Required:
// student_id
// subject_code
// date
// status
//
// session + stream -> students table se
// ======================================================

const markSubjectAttendance = async (req, res) => {
  try {
    const {
      student_id,
      subject_code,
      date,
      status,
    } = req.body;

    // --------------------------------------------------
    // Basic Validation
    // --------------------------------------------------
    if (
      !student_id ||
      !subject_code ||
      !date ||
      !status
    ) {
      return res.status(400).json({
        success: false,
        message:
          "student_id, subject_code, date and status are required",
      });
    }

    if (!["Present", "Absent"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be Present or Absent",
      });
    }

    // --------------------------------------------------
    // Get Student Details
    // --------------------------------------------------
    const studentResult = await pool.query(
      `
      SELECT
        id,
        class,
        stream,
        session
      FROM students
      WHERE id = $1
      `,
      [student_id]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student = studentResult.rows[0];

    // --------------------------------------------------
    // Only 8th to 12th
    // --------------------------------------------------
    if (
      Number(student.class) < 8 ||
      Number(student.class) > 12
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Subject-wise attendance is applicable only from class 8th to 12th",
      });
    }

    // --------------------------------------------------
    // Check Subject
    // --------------------------------------------------
    const subjectResult = await pool.query(
      `
      SELECT
        subject_code,
        subject_name
      FROM subjects
      WHERE subject_code = $1
        AND CAST(class AS INTEGER) = $2
      `,
      [subject_code, student.class]
    );

    if (subjectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Subject not found for this student's class",
      });
    }

    // --------------------------------------------------
    // Check Existing Attendance
    // --------------------------------------------------
    const existing = await pool.query(
      `
      SELECT id
      FROM subject_attendance
      WHERE student_id = $1
        AND subject_code = $2
        AND date = $3
      `,
      [
        student_id,
        subject_code,
        date,
      ]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Attendance already marked for this student, subject and date",
      });
    }

    // --------------------------------------------------
    // Calculate Month
    // --------------------------------------------------
    const month = new Date(date).toLocaleString(
      "en-US",
      {
        month: "long",
      }
    );

    // --------------------------------------------------
    // Insert Attendance
    //
    // session + stream students table se liye ja rahe hain
    // percentage daily record me NULL rahega
    // --------------------------------------------------
    const result = await pool.query(
      `
      INSERT INTO subject_attendance
      (
        student_id,
        subject_code,
        session,
        stream,
        date,
        status,
        percentage,
        month
      )
      VALUES
      ($1, $2, $3, $4, $5, $6, NULL, $7)
      RETURNING *
      `,
      [
        student_id,
        subject_code,
        student.session,
        student.stream,
        date,
        status,
        month,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Subject attendance marked successfully",
      attendance: result.rows[0],
    });
  } catch (error) {
    console.error(
      "markSubjectAttendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to mark subject attendance",
    });
  }
};


// ======================================================
// 3. UPDATE / EDIT SUBJECT ATTENDANCE
// ======================================================
//
// Attendance ID se record edit hoga.
//
// Allowed:
// Present -> Absent
// Absent -> Present
// ======================================================

const updateSubjectAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "status is required",
      });
    }

    if (!["Present", "Absent"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be Present or Absent",
      });
    }

    // --------------------------------------------------
    // Check Attendance Record
    // --------------------------------------------------
    const existing = await pool.query(
      `
      SELECT
        id,
        student_id,
        subject_code,
        date
      FROM subject_attendance
      WHERE id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    // --------------------------------------------------
    // Update Status
    // --------------------------------------------------
    const result = await pool.query(
      `
      UPDATE subject_attendance
      SET status = $1
      WHERE id = $2
      RETURNING *
      `,
      [status, id]
    );

    return res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      attendance: result.rows[0],
    });
  } catch (error) {
    console.error(
      "updateSubjectAttendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update attendance",
    });
  }
};


// ======================================================
// 4. DELETE SUBJECT ATTENDANCE
// ======================================================

const deleteSubjectAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM subject_attendance
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance deleted successfully",
      attendance: result.rows[0],
    });
  } catch (error) {
    console.error(
      "deleteSubjectAttendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete attendance",
    });
  }
};


// ======================================================
// 5. GET ADMIN SUBJECT ATTENDANCE LIST
// ======================================================
//
// Admin filters:
// class
// stream
// session
// subject_code
// date
//
// class/stream/session -> students table
// subject -> subject_attendance.subject_code
// ======================================================

const getAdminSubjectAttendance = async (req, res) => {
  try {
    const {
      class: studentClass,
      stream,
      session,
      subject_code,
      date,
    } = req.query;

    let query = `
      SELECT
        st.id AS student_id,
        st.name,
        st.class,
        st.stream,
        st.session,

        sa.id AS attendance_id,
        sa.subject_code,
        sa.date,
        sa.status,
        sa.percentage,
        sa.month,

        sub.subject_name

      FROM students st

      LEFT JOIN subject_attendance sa
        ON sa.student_id = st.id

      LEFT JOIN subjects sub
        ON sub.subject_code = sa.subject_code
        AND CAST(sub.class AS INTEGER) = CAST(st.class AS INTEGER)

      WHERE CAST(st.class AS INTEGER) BETWEEN 8 AND 12
    `;

    const values = [];
    let index = 1;

    // --------------------------------------------------
    // Class Filter
    // --------------------------------------------------
    if (studentClass) {
      query += ` AND st.class = $${index}`;
      values.push(studentClass);
      index++;
    }

    // --------------------------------------------------
    // Stream Filter
    // --------------------------------------------------
    if (stream) {
      query += ` AND st.stream = $${index}`;
      values.push(stream);
      index++;
    }

    // --------------------------------------------------
    // Session Filter
    // --------------------------------------------------
    if (session) {
      query += ` AND st.session = $${index}`;
      values.push(session);
      index++;
    }

    // --------------------------------------------------
    // Subject Filter
    // --------------------------------------------------
    if (subject_code) {
      query += ` AND sa.subject_code = $${index}`;
      values.push(subject_code);
      index++;
    }

    // --------------------------------------------------
    // Date Filter
    // --------------------------------------------------
    if (date) {
      query += ` AND sa.date = $${index}`;
      values.push(date);
      index++;
    }

    query += `
      ORDER BY
        CAST(st.class AS INTEGER),
        st.name,
        sa.date,
        sa.subject_code
    `;

    const result = await pool.query(
      query,
      values
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      "getAdminSubjectAttendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin attendance",
    });
  }
};


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getStudentSubjectAttendance,
  markSubjectAttendance,
  updateSubjectAttendance,
  deleteSubjectAttendance,
  getAdminSubjectAttendance,
};

