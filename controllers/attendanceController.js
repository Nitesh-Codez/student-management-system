const db = require("../db");

// ============================================================
// HELPER: DEFAULT DATE
// ============================================================
const getTodayDate = () => {
  const today = new Date();

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

// ============================================================
// HELPER: NORMALIZE BATCH
// ============================================================
const normalizeBatch = (batch) => {
  return String(batch || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
};

/* =========================================================
   GET STUDENTS + THAT DATE'S ATTENDANCE
   1 STUDENT = 1 ROW
========================================================= */
exports.getStudentsList = async (req, res) => {
  try {
    const date = req.query.date || getTodayDate();

    const { rows } = await db.query(`
      SELECT DISTINCT ON (s.id)
        s.id AS "studentId",
        s.name AS "studentName",
        s."class",
        s.stream,
        s.batch,
        s.joining_date AS "joiningDate",

        CASE
          WHEN LOWER(REPLACE(s.batch,' ','')) = 'batch1'
            THEN '3:00 PM - 4:30 PM'
          WHEN LOWER(REPLACE(s.batch,' ','')) = 'batch2'
            THEN '4:30 PM - 6:00 PM'
          WHEN LOWER(REPLACE(s.batch,' ','')) = 'batch3'
            THEN '6:00 PM - 7:30 PM'
          ELSE 'Not Assigned'
        END AS "batchTime",

        a.id AS "attendanceId",
        a.status,
        a.subject_code AS "subjectCode",
        a.start_time AS "startTime",
        a.end_time AS "endTime"

      FROM students s

      LEFT JOIN attendance a
        ON a.student_id = s.id
       AND a.date::date = $1::date

      WHERE s.role = 'student'

      ORDER BY
        s.id,
        a.id DESC NULLS LAST
    `, [date]);

    return res.json({
      success: true,
      date,
      students: rows
    });

  } catch (error) {
    console.error("getStudentsList:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch attendance"
    });
  }
};


/* =========================================================
   ADD / UPDATE ATTENDANCE
   1 STUDENT + 1 DATE = 1 RECORD
========================================================= */
exports.markAttendance = async (req, res) => {
  let client;

  try {
    const {
      date = getTodayDate(),
      attendance
    } = req.body;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date. Use YYYY-MM-DD"
      });
    }

    if (!Array.isArray(attendance) || !attendance.length) {
      return res.status(400).json({
        success: false,
        message: "Attendance data required"
      });
    }

    client = await db.connect();
    await client.query("BEGIN");

    let inserted = 0;
    let updated = 0;

    for (const item of attendance) {
      const studentId = Number(item.studentId);

      if (!studentId) continue;

      const status = item.status;

      if (!["Present", "Absent", "Holiday"].includes(status)) {
        continue;
      }

      const subjectCode =
        item.subjectCode ||
        item.subject_code ||
        null;

      const startTime =
        item.startTime ||
        item.start_time ||
        null;

      const endTime =
        item.endTime ||
        item.end_time ||
        null;

      const stream = item.stream || null;

      /* ONE STUDENT + ONE DATE */
      const result = await client.query(`
        INSERT INTO attendance
        (
          student_id,
          date,
          status,
          subject_code,
          start_time,
          end_time,
          stream
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)

        ON CONFLICT (student_id, date)
        DO UPDATE SET
          status = EXCLUDED.status,
          subject_code = EXCLUDED.subject_code,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          stream = EXCLUDED.stream

        RETURNING
          id,
          (xmax = 0) AS inserted
      `, [
        studentId,
        date,
        status,
        subjectCode,
        startTime,
        endTime,
        stream
      ]);

      if (result.rows[0].inserted) {
        inserted++;
      } else {
        updated++;
      }
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Attendance saved successfully",
      date,
      inserted,
      updated
    });

  } catch (error) {

    if (client) {
      await client.query("ROLLBACK");
    }

    console.error("markAttendance:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save attendance",
      error: error.message
    });

  } finally {
    if (client) client.release();
  }
};


/* =========================================================
   EDIT EXISTING ATTENDANCE
   SAME RECORD UPDATE HOGA
========================================================= */
exports.editAttendance = async (req, res) => {
  try {
    const {
      id,
      studentId,
      date,
      status,
      subjectCode,
      startTime,
      endTime,
      stream
    } = req.body;

    if (!date || !status) {
      return res.status(400).json({
        success: false,
        message: "Date and status are required"
      });
    }

    if (!["Present", "Absent", "Holiday"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status"
      });
    }

    let query;
    let params;

    /* EDIT BY ATTENDANCE ID */
    if (id) {

      query = `
        UPDATE attendance
        SET
          status = $1,
          subject_code = $2,
          start_time = $3,
          end_time = $4,
          stream = $5
        WHERE id = $6
          AND date::date = $7::date
        RETURNING *
      `;

      params = [
        status,
        subjectCode || null,
        startTime || null,
        endTime || null,
        stream || null,
        id,
        date
      ];

    } else {

      /* EDIT BY STUDENT + DATE */

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: "studentId or attendance id required"
        });
      }

      query = `
        UPDATE attendance
        SET
          status = $1,
          subject_code = $2,
          start_time = $3,
          end_time = $4,
          stream = $5
        WHERE student_id = $6
          AND date::date = $7::date
        RETURNING *
      `;

      params = [
        status,
        subjectCode || null,
        startTime || null,
        endTime || null,
        stream || null,
        studentId,
        date
      ];
    }

    const { rows } = await db.query(query, params);

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found"
      });
    }

    return res.json({
      success: true,
      message: "Attendance updated successfully",
      attendance: rows[0]
    });

  } catch (error) {

    console.error("editAttendance:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to edit attendance",
      error: error.message
    });
  }
};

// =====================================================
// GET SUBJECT-WISE ATTENDANCE
// =====================================================
exports.getSubjectWiseAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "studentId is required",
      });
    }

    const result = await db.query(
      `
      SELECT
        subject_code,
        COUNT(*) FILTER (WHERE status = 'Present') AS present,
        COUNT(*) FILTER (WHERE status = 'Absent') AS absent,
        COUNT(*) FILTER (
          WHERE status IN ('Present', 'Absent')
        ) AS total
      FROM attendance
      WHERE student_id = $1
        AND subject_code IS NOT NULL
      GROUP BY subject_code
      ORDER BY subject_code
      `,
      [studentId]
    );

    const subjects = result.rows.map((row) => {
      const present = Number(row.present);
      const absent = Number(row.absent);
      const total = Number(row.total);

      return {
        subjectCode: row.subject_code,
        present,
        absent,
        total,
        percentage:
          total === 0
            ? 0
            : Number(((present / total) * 100).toFixed(1)),
      };
    });

    return res.json({
      success: true,
      studentId: Number(studentId),
      subjects,
    });
  } catch (error) {
    console.error("Error fetching subject-wise attendance:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching subject-wise attendance",
    });
  }
};

// ============================================================
// 3) ADMIN: SHIFT STUDENT FROM ONE BATCH TO ANOTHER
// ============================================================
exports.shiftStudentBatch = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { batch } = req.body;

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------
    if (!studentId || !batch) {
      return res.status(400).json({
        success: false,
        message:
          "Student ID and target batch are required",
      });
    }

    const normalizedBatch = normalizeBatch(batch);

    const validBatches = [
      "batch1",
      "batch2",
      "batch3",
    ];

    if (!validBatches.includes(normalizedBatch)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid batch. Use batch1, batch2 or batch3",
      });
    }

    // --------------------------------------------------------
    // CHECK STUDENT
    // --------------------------------------------------------
    const studentResult = await db.query(
      `
      SELECT
        id,
        name,
        batch
      FROM students
      WHERE id = $1
        AND role = 'student'
      `,
      [studentId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student =
      studentResult.rows[0];

    // --------------------------------------------------------
    // SAME BATCH
    // --------------------------------------------------------
    if (
      normalizeBatch(student.batch) ===
      normalizedBatch
    ) {
      return res.status(400).json({
        success: false,
        message:
          `${student.name} is already in ${normalizedBatch}`,
      });
    }

    // --------------------------------------------------------
    // UPDATE
    // --------------------------------------------------------
    const updateResult = await db.query(
      `
      UPDATE students
      SET batch = $1
      WHERE id = $2
        AND role = 'student'

      RETURNING
        id,
        name,
        class,
        batch
      `,
      [
        normalizedBatch,
        studentId,
      ]
    );

    return res.json({
      success: true,
      message:
        `${student.name} shifted successfully to ${normalizedBatch}`,
      student:
        updateResult.rows[0],
    });

  } catch (error) {
    console.error(
      "Error shifting student batch:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Server error while shifting student batch",
    });
  }
};


// ============================================================
// ADMIN: GET ALL STUDENTS SUBJECT-WISE ATTENDANCE FOR MONTH
// ============================================================
exports.getAllStudentsSubjectWiseAttendance = async (req, res) => {
  try {
    const { month } = req.query;

    // --------------------------------------------------------
    // VALIDATION
    // month format: YYYY-MM
    // Example: 2026-09
    // --------------------------------------------------------
    if (!month) {
      return res.status(400).json({
        success: false,
        message: "month is required. Use YYYY-MM format",
      });
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: "Invalid month format. Use YYYY-MM",
      });
    }

    // --------------------------------------------------------
    // FETCH ALL STUDENTS + SUBJECT ATTENDANCE
    // --------------------------------------------------------
    const result = await db.query(
      `
      SELECT
        s.id AS student_id,
        s.name,
        s.class,
        s.batch,
        s.stream,

        a.subject_code,

        COUNT(*) FILTER (
          WHERE a.status = 'Present'
        ) AS present,

        COUNT(*) FILTER (
          WHERE a.status = 'Absent'
        ) AS absent,

        COUNT(*) FILTER (
          WHERE a.status IN ('Present', 'Absent')
        ) AS total

      FROM students s

      LEFT JOIN attendance a
        ON a.student_id = s.id
        AND a.subject_code IS NOT NULL
        AND a.date >= ($1 || '-01')::date
        AND a.date < (
          TO_DATE($1, 'YYYY-MM') + INTERVAL '1 month'
        )

      WHERE s.role = 'student'

      GROUP BY
        s.id,
        s.name,
        s.class,
        s.batch,
        s.stream,
        a.subject_code

      ORDER BY
        s.class,
        s.name,
        a.subject_code
      `,
      [month]
    );

    // --------------------------------------------------------
    // GROUP DATA STUDENT-WISE
    // --------------------------------------------------------
    const studentsMap = {};

    result.rows.forEach((row) => {
      const studentId = row.student_id;

      if (!studentsMap[studentId]) {
        studentsMap[studentId] = {
          studentId: Number(studentId),
          name: row.name,
          class: row.class,
          batch: row.batch,
          stream: row.stream,
          subjects: [],
        };
      }

      // Student may have no attendance in selected month
      if (row.subject_code) {
        const present = Number(row.present);
        const absent = Number(row.absent);
        const total = Number(row.total);

        studentsMap[studentId].subjects.push({
          subjectCode: row.subject_code,
          present,
          absent,
          total,
          percentage:
            total === 0
              ? 0
              : Number(((present / total) * 100).toFixed(1)),
        });
      }
    });

    const students = Object.values(studentsMap);

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------
    return res.json({
      success: true,
      month,
      totalStudents: students.length,
      students,
    });

  } catch (error) {
    console.error(
      "Error fetching all students subject-wise attendance:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Server error while fetching monthly subject-wise attendance",
    });
  }
};
// ============================================================
// 4) GET INDIVIDUAL STUDENT FULL ATTENDANCE HISTORY
//
// Returns subject + time also.
// ============================================================
exports.getStudentAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Student ID required",
      });
    }

    const sql = `
      SELECT
        date,
        subject_code AS "subjectCode",
        start_time AS "startTime",
        end_time AS "endTime",
        status

      FROM attendance

      WHERE student_id = $1

      ORDER BY
        date DESC,
        start_time DESC
    `;

    const { rows } = await db.query(
      sql,
      [id]
    );

    return res.json({
      success: true,
      attendance: rows,
    });

  } catch (error) {
    console.error(
      "Error fetching student attendance:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Server error while fetching records",
    });
  }
};

// ============================================================
// 5) GET ALL STUDENTS ATTENDANCE SUMMARY
//
// Subject-wise attendance entries are counted individually.
// ============================================================
exports.getTodayAttendancePercent = async (
  req,
  res
) => {
  try {
    const sql = `
      SELECT

        s.id AS "studentId",

        s.name AS name,

        s.class AS class,

        COALESCE(
          SUM(
            CASE
              WHEN a.status = 'Present'
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS present,

        COALESCE(
          SUM(
            CASE
              WHEN a.status IN ('Present', 'Absent')
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS total

      FROM students s

      LEFT JOIN attendance a
        ON s.id = a.student_id

      WHERE s.role = 'student'

      GROUP BY
        s.id,
        s.name,
        s.class

      ORDER BY s.id
    `;

    const { rows } = await db.query(sql);

    const result = rows.map((r) => {
      const present =
        parseInt(r.present, 10) || 0;

      const total =
        parseInt(r.total, 10) || 0;

      const percentage =
        total === 0
          ? 0
          : (present / total) * 100;

      // ------------------------------------------------------
      // MARKS
      // 75% se upar har 5% par 1 mark
      // Maximum 5 marks
      // ------------------------------------------------------
      let marks = 0;

      if (percentage > 75) {
        marks = Math.min(
          5,
          Math.ceil(
            (percentage - 75) / 5
          )
        );
      }

      return {
        studentId: r.studentId,
        name: r.name,
        class: r.class,
        present,
        total,
        percentage:
          percentage.toFixed(2),
        marks,
      };
    });

    return res.json({
      success: true,
      date: getTodayDate(),
      students: result,
    });

  } catch (error) {
    console.error(
      "Error getting attendance summary:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============================================================
// 6) GET ATTENDANCE MARKS - MONTHLY
//
// Optional subject filter:
//
// ?studentId=10&month=2026-09
//
// OR
//
// ?studentId=10&month=2026-09&subject_code=Science
// ============================================================
exports.getAttendanceMarks = async (
  req,
  res
) => {
  try {
    const {
      studentId,
      month,
      subject_code,
    } = req.query;

    if (!studentId || !month) {
      return res.status(400).json({
        success: false,
        message:
          "studentId & month required",
      });
    }

    const id = Number(studentId);

    const monthStr =
      String(month).trim();

    // --------------------------------------------------------
    // BASE QUERY
    // --------------------------------------------------------
    let sql = `
      SELECT
        status,
        subject_code,
        start_time,
        end_time

      FROM attendance

      WHERE student_id = $1

      AND date::text LIKE $2
    `;

    const params = [
      id,
      `${monthStr}%`,
    ];

    // --------------------------------------------------------
    // OPTIONAL SUBJECT FILTER
    // --------------------------------------------------------
    if (subject_code) {
      sql += `
        AND subject_code = $3
      `;

      params.push(subject_code);
    }

    const { rows } = await db.query(
      sql,
      params
    );

    // --------------------------------------------------------
    // ONLY PRESENT / ABSENT
    // --------------------------------------------------------
    const validDays =
      rows.filter(
        (r) =>
          r.status === "Present" ||
          r.status === "Absent"
      ).length;

    const presentDays =
      rows.filter(
        (r) =>
          r.status === "Present"
      ).length;

    const percentage =
      validDays === 0
        ? 0
        : (presentDays / validDays) * 100;

    // --------------------------------------------------------
    // MARKS
    // --------------------------------------------------------
    let marks = 0;

    if (percentage > 75) {
      marks = Math.ceil(
        (percentage - 75) / 5
      );

      marks = Math.min(
        marks,
        5
      );
    }

    return res.json({
      success: true,

      studentId: id,

      month: monthStr,

      subject_code:
        subject_code || null,

      totalClasses: validDays,

      presentClasses:
        presentDays,

      absentClasses:
        validDays - presentDays,

      percentage:
        percentage.toFixed(2),

      attendanceMarks:
        marks,
    });

  } catch (error) {
    console.error(
      "Error getting attendance marks:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Server error while fetching attendance marks",
    });
  }
};

// ===================================================================
// REQUESTS
// ===================================================================

// ============================================================
// 7) ADMIN: GET ALL STUDENT DROP + PROFILE EDIT REQUESTS
// ============================================================
exports.getAllStudentRequests = async (
  req,
  res
) => {
  try {
    const sql = `
      SELECT

        s.id AS "studentId",

        s.name AS "studentName",

        s.email,

        sd.id AS "dropId",

        sd.start_date AS "dropStartDate",

        sd.end_date AS "dropEndDate",

        sd.drop_type AS "dropType",

        per.id AS "requestId",

        per.field_name AS "fieldName",

        per.old_value AS "oldValue",

        per.requested_value AS "requestedValue",

        per.reason,

        per.status AS "requestStatus",

        per.requested_at AS "requestedAt",

        per.action_by AS "actionBy",

        per.action_at AS "actionAt",

        per.request_type AS "requestType"

      FROM students s

      LEFT JOIN student_drop sd
        ON s.id = sd.student_id

      LEFT JOIN profile_edit_requests per
        ON s.id = per.student_id

      WHERE s.role = 'student'

      ORDER BY
        s.id DESC,
        per.requested_at DESC
    `;

    const { rows } =
      await db.query(sql);

    return res.json({
      success: true,
      students: rows,
    });

  } catch (error) {
    console.error(
      "Error fetching student requests:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Server error while fetching student requests",
    });
  }
};

// ============================================================
// 8) STUDENT: GET OWN DROP + PROFILE EDIT REQUEST
// ============================================================
exports.getMyStudentRequests = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message:
          "Student ID required",
      });
    }

    const sql = `
      SELECT

        s.id AS "studentId",

        s.name AS "studentName",

        s.email,

        sd.id AS "dropId",

        sd.start_date AS "dropStartDate",

        sd.end_date AS "dropEndDate",

        sd.drop_type AS "dropType",

        per.id AS "requestId",

        per.field_name AS "fieldName",

        per.old_value AS "oldValue",

        per.requested_value AS "requestedValue",

        per.reason,

        per.status AS "requestStatus",

        per.requested_at AS "requestedAt",

        per.action_by AS "actionBy",

        per.action_at AS "actionAt",

        per.request_type AS "requestType"

      FROM students s

      LEFT JOIN student_drop sd
        ON s.id = sd.student_id

      LEFT JOIN profile_edit_requests per
        ON s.id = per.student_id

      WHERE s.id = $1

        AND s.role = 'student'

      ORDER BY
        per.requested_at DESC
    `;

    const { rows } =
      await db.query(
        sql,
        [id]
      );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found",
      });
    }

    return res.json({
      success: true,
      student: rows,
    });

  } catch (error) {
    console.error(
      "Error fetching student data:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Server error while fetching student data",
    });
  }
};

// ============================================================
// ADMIN: FETCH DONE ATTENDANCE / SCHEDULE DATE-WISE
// ============================================================
exports.fetchDoneSchedule = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required"
      });
    }

    const { rows } = await db.query(`
      SELECT
        a.id AS "attendanceId",
        a.student_id AS "studentId",
        s.name AS "studentName",
        s.class,
        s.stream,
        s.batch,
        a.date,
        a.subject_code AS "subjectCode",
        a.start_time AS "startTime",
        a.end_time AS "endTime",
        a.status
      FROM attendance a
      JOIN students s
        ON s.id = a.student_id
      WHERE a.date::date = $1::date
      ORDER BY a.start_time, s.name
    `, [date]);

    return res.json({
      success: true,
      date,
      totalRecords: rows.length,
      attendance: rows
    });

  } catch (error) {
    console.error("fetchDoneSchedule ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching records",
      error: error.message
    });
  }
};


// ============================================================
// STUDENT: FETCH OWN DONE CLASSES / ATTENDANCE DATE-WISE
exports.fetchStudentDoneClassesSchedule = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required"
      });
    }

    const { rows } = await db.query(`
      SELECT
        a.student_id AS "studentId",
        a.start_time AS "startTime",
        a.end_time AS "endTime",
        a.subject_code AS "subject",
        a.status,
        s.stream,
        a.date

      FROM attendance a

      INNER JOIN students s
        ON s.id = a.student_id

      WHERE a.student_id = $1
        AND s.role = 'student'

      ORDER BY
        a.date DESC,
        a.start_time DESC NULLS LAST
    `, [studentId]);

    return res.json({
      success: true,
      studentId: Number(studentId),
      totalRecords: rows.length,
      classes: rows
    });

  } catch (error) {
    console.error(
      "fetchStudentDoneClassesSchedule:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch student completed classes",
      error: error.message
    });
  }
};