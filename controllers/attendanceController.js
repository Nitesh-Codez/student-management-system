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

// ============================================================
// 1) GET ALL STUDENTS + ATTENDANCE
//
// Supports:
//
// GET /api/attendance/list?date=2026-09-30
//
// Subject-wise:
//
// GET /api/attendance/list
//   ?date=2026-09-30
//   &subject_code=Science
//   &start_time=18:00:00
//   &end_time=18:40:00
// ============================================================
exports.getStudentsList = async (req, res) => {
  try {
    let {
      date,
      subject_code,
      start_time,
      end_time,
    } = req.query;

    // --------------------------------------------------------
    // DEFAULT DATE
    // --------------------------------------------------------
    if (!date) {
      date = getTodayDate();
    }

    // --------------------------------------------------------
    // BASE QUERY
    // --------------------------------------------------------
    let sql = `
      SELECT
        s.id AS "studentId",
        s.name AS "studentName",
        s."class" AS "class",
        s.batch AS "batch",

        CASE
          WHEN LOWER(REPLACE(s.batch, ' ', '')) = 'batch1'
            THEN '3:00 PM - 4:30 PM'

          WHEN LOWER(REPLACE(s.batch, ' ', '')) = 'batch2'
            THEN '4:30 PM - 6:00 PM'

          WHEN LOWER(REPLACE(s.batch, ' ', '')) = 'batch3'
            THEN '6:00 PM - 7:30 PM'

          ELSE 'Not Assigned'
        END AS "batchTime",

        COALESCE(a.status, 'Absent') AS status,

        a.subject_code AS "subjectCode",
        a.start_time AS "startTime",
        a.end_time AS "endTime"

      FROM students s

      LEFT JOIN attendance a
        ON s.id = a.student_id
        AND a.date::date = $1
    `;

    const params = [date];

    // --------------------------------------------------------
    // SUBJECT-WISE ATTENDANCE
    // --------------------------------------------------------
    if (subject_code && start_time && end_time) {
      sql += `
        AND a.subject_code = $2
        AND a.start_time = $3
        AND a.end_time = $4
      `;

      params.push(
        subject_code,
        start_time,
        end_time
      );
    }

    // --------------------------------------------------------
    // ONLY STUDENTS
    // --------------------------------------------------------
    sql += `
      WHERE s.role = 'student'

      ORDER BY
        CASE
          WHEN LOWER(REPLACE(s.batch, ' ', '')) = 'batch1'
            THEN 1

          WHEN LOWER(REPLACE(s.batch, ' ', '')) = 'batch2'
            THEN 2

          WHEN LOWER(REPLACE(s.batch, ' ', '')) = 'batch3'
            THEN 3

          ELSE 4
        END,

        s.id
    `;

    const { rows } = await db.query(sql, params);

    return res.json({
      success: true,
      date,
      subject_code: subject_code || null,
      start_time: start_time || null,
      end_time: end_time || null,
      students: rows,
    });

  } catch (error) {
    console.error(
      "Error fetching students:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Server error while fetching students",
    });
  }
};

// ============================================================
// 2) MARK / UPDATE SUBJECT ATTENDANCE
//
// Body:
//
// {
//   "date": "2026-09-30",
//   "subject_code": "Science",
//   "start_time": "18:00:00",
//   "end_time": "18:40:00",
//   "attendance": [
//      {
//        "studentId": 1,
//        "status": "Present"
//      }
//   ]
// }
// ============================================================
exports.markAttendance = async (req, res) => {
  try {
    let {
      date,
      subject_code,
      start_time,
      end_time,
      attendance,
    } = req.body;

    // --------------------------------------------------------
    // DEFAULT DATE
    // --------------------------------------------------------
    if (!date) {
      date = getTodayDate();
    }

    // --------------------------------------------------------
    // REQUIRED FIELDS
    // --------------------------------------------------------
    if (
      !subject_code ||
      !start_time ||
      !end_time
    ) {
      return res.status(400).json({
        success: false,
        message:
          "subject_code, start_time and end_time are required",
      });
    }

    // --------------------------------------------------------
    // VALIDATE ATTENDANCE ARRAY
    // --------------------------------------------------------
    if (!Array.isArray(attendance)) {
      return res.status(400).json({
        success: false,
        message:
          "attendance must be an array",
      });
    }

    // --------------------------------------------------------
    // TRANSACTION
    // --------------------------------------------------------
    const client = await db.connect();

    try {
      await client.query("BEGIN");

      for (const item of attendance) {
        if (
          !item.studentId ||
          !item.status
        ) {
          continue;
        }

        if (
          !["Present", "Absent"].includes(
            item.status
          )
        ) {
          continue;
        }

        await client.query(
          `
          INSERT INTO attendance
          (
            student_id,
            date,
            subject_code,
            start_time,
            end_time,
            status
          )
          VALUES
          ($1, $2, $3, $4, $5, $6)

          ON CONFLICT
          (
            student_id,
            date,
            subject_code,
            start_time,
            end_time
          )

          DO UPDATE SET
            status = EXCLUDED.status
          `,
          [
            item.studentId,
            date,
            subject_code,
            start_time,
            end_time,
            item.status,
          ]
        );
      }

      await client.query("COMMIT");

    } catch (error) {
      await client.query("ROLLBACK");
      throw error;

    } finally {
      client.release();
    }

    return res.json({
      success: true,
      message:
        "Subject attendance saved successfully!",
      date,
      subject_code,
      start_time,
      end_time,
      total_students: attendance.length,
    });

  } catch (error) {
    console.error(
      "Error saving subject attendance:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Server error while saving attendance",
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