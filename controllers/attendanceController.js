const db = require("../db");

// ============================================================
// HELPERS
// ============================================================

const getTodayDate = () => {
  const today = new Date();

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

const normalizeBatch = (batch) =>
  String(batch || "").trim().toLowerCase().replace(/\s+/g, "");

const normalizeSubject = (subject) =>
  String(subject || "").trim().toLowerCase();

const isValidDate = (date) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  !Number.isNaN(Date.parse(`${date}T00:00:00Z`));

const getAttendancePercentage = (present, total) =>
  total === 0 ? 0 : Number(((present / total) * 100).toFixed(1));

const getAttendanceMarks = (percentage) =>
  percentage > 75
    ? Math.min(5, Math.ceil((percentage - 75) / 5))
    : 0;

// ============================================================
// 1. GET STUDENTS + SELECTED DATE ATTENDANCE
// Keeps one row per student for the admin marking screen.
// Optional filters: subjectCode, startTime, endTime.
// ============================================================

exports.getStudentsList = async (req, res) => {
  try {
    const date = req.query.date || getTodayDate();
    const { subjectCode, startTime, endTime } = req.query;

    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date. Use YYYY-MM-DD",
      });
    }

    const { rows } = await db.query(
      `
      SELECT
        s.id AS "studentId",
        s.name AS "studentName",
        s.class,
        s.stream,
        s.batch,
        s.joining_date AS "joiningDate",

        CASE
          WHEN LOWER(REPLACE(s.batch, ' ', '')) = 'batch1'
            THEN '3:00 PM - 4:30 PM'
          WHEN LOWER(REPLACE(s.batch, ' ', '')) = 'batch2'
            THEN '4:30 PM - 6:00 PM'
          WHEN LOWER(REPLACE(s.batch, ' ', '')) = 'batch3'
            THEN '6:00 PM - 7:30 PM'
          ELSE 'Not Assigned'
        END AS "batchTime",

        a.id AS "attendanceId",
        a.status,
        a.subject_code AS "subjectCode",
        a.start_time AS "startTime",
        a.end_time AS "endTime",
        a.reason

      FROM students s

      LEFT JOIN LATERAL (
        SELECT a.*
        FROM attendance a
        WHERE a.student_id = s.id
          AND a.date::date = $1::date
          AND (
            $2::text IS NULL
            OR LOWER(TRIM(a.subject_code)) = LOWER(TRIM($2))
          )
          AND (
            $3::time IS NULL
            OR a.start_time = $3::time
          )
          AND (
            $4::time IS NULL
            OR a.end_time = $4::time
          )
        ORDER BY a.id DESC
        LIMIT 1
      ) a ON TRUE

      WHERE s.role = 'student'

      ORDER BY s.id
      `,
      [
        date,
        subjectCode || null,
        startTime || null,
        endTime || null,
      ]
    );

    return res.json({
      success: true,
      date,
      students: rows,
    });
  } catch (error) {
    console.error("getStudentsList:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance",
    });
  }
};

// ============================================================
// 2. ADD / UPDATE ATTENDANCE
// One student + date + subject + lecture time = one record.
// Supports Holiday reason and exam subject details.
// ============================================================

exports.markAttendance = async (req, res) => {
  let client;
  let transactionStarted = false;

  try {
    const date = req.body.date || getTodayDate();
    const attendance = req.body.attendance;

    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date. Use YYYY-MM-DD",
      });
    }

    if (!Array.isArray(attendance) || attendance.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Attendance data required",
      });
    }

    // Convert "03:00 PM" / "15:00" into PostgreSQL time format.
    const toDbTime = (value) => {
      if (value == null || String(value).trim() === "") return null;

      const time = String(value).trim().toUpperCase();
      const match = time.match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/
      );

      if (!match) {
        throw new Error(`Invalid time format: ${value}`);
      }

      let hours = Number(match[1]);
      const minutes = Number(match[2]);
      const seconds = Number(match[3] || 0);
      const period = match[4];

      if (minutes > 59 || seconds > 59) {
        throw new Error(`Invalid time value: ${value}`);
      }

      if (period) {
        if (hours < 1 || hours > 12) {
          throw new Error(`Invalid time value: ${value}`);
        }
        if (period === "AM" && hours === 12) hours = 0;
        if (period === "PM" && hours !== 12) hours += 12;
      } else if (hours > 23) {
        throw new Error(`Invalid time value: ${value}`);
      }

      return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(seconds).padStart(2, "0"),
      ].join(":");
    };

    client = await db.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of attendance) {
      const studentId = Number(item.studentId);
      const status = item.status;

      if (!Number.isInteger(studentId) || studentId <= 0) {
        skipped++;
        continue;
      }

      if (!["Present", "Absent", "Holiday"].includes(status)) {
        skipped++;
        continue;
      }

      const subjectCode = item.subjectCode ?? item.subject_code ?? null;
      const startTime = toDbTime(item.startTime ?? item.start_time);
      const endTime = toDbTime(item.endTime ?? item.end_time);
      const stream = item.stream ?? null;
      const reason = item.reason ?? null;

      // Confirm student exists.
      const studentCheck = await client.query(
        "SELECT id FROM students WHERE id = $1",
        [studentId]
      );

      if (studentCheck.rowCount === 0) {
        skipped++;
        continue;
      }

      // Find the exact lecture, including NULL subject/times.
      const existing = await client.query(
        `
        SELECT id
        FROM attendance
        WHERE student_id = $1
          AND date::date = $2::date
          AND subject_code IS NOT DISTINCT FROM $3::text
          AND start_time IS NOT DISTINCT FROM $4::time
          AND end_time IS NOT DISTINCT FROM $5::time
        ORDER BY id DESC
        LIMIT 1
        `,
        [studentId, date, subjectCode, startTime, endTime]
      );

      if (existing.rowCount > 0) {
        await client.query(
          `
          UPDATE attendance
          SET status = $1,
              stream = $2,
              reason = $3
          WHERE id = $4
          `,
          [status, stream, reason, existing.rows[0].id]
        );

        updated++;
      } else {
        await client.query(
          `
          INSERT INTO attendance (
            student_id, date, status, subject_code,
            start_time, end_time, stream, reason
          )
          VALUES (
            $1, $2::date, $3, $4,
            $5::time, $6::time, $7, $8
          )
          `,
          [
            studentId,
            date,
            status,
            subjectCode,
            startTime,
            endTime,
            stream,
            reason,
          ]
        );

        inserted++;
      }
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return res.json({
      success: true,
      message: "Attendance saved successfully",
      date,
      inserted,
      updated,
      skipped,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Attendance rollback error:", rollbackError.message);
      }
    }

    console.error("markAttendance error:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
    });

    return res.status(500).json({
      success: false,
      message: "Failed to save attendance",
      error: error.message,
      code: error.code || null,
    });
  } finally {
    if (client) client.release();
  }
};


// ============================================================
// 3. EDIT EXISTING ATTENDANCE
// ============================================================



exports.editAttendance = async (req, res) => {
  let client;
  let transactionStarted = false;

  try {
    const { date, attendance } = req.body;

    if (!date || !isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Valid date is required (YYYY-MM-DD)",
      });
    }

    if (!Array.isArray(attendance) || attendance.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Attendance data required",
      });
    }

    const toDbTime = (value) => {
      if (value == null || String(value).trim() === "") return null;

      const match = String(value).trim().toUpperCase().match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/
      );

      if (!match) throw new Error(`Invalid time format: ${value}`);

      let hours = Number(match[1]);
      const minutes = Number(match[2]);
      const seconds = Number(match[3] || 0);
      const period = match[4];

      if (minutes > 59 || seconds > 59) {
        throw new Error(`Invalid time value: ${value}`);
      }

      if (period) {
        if (hours < 1 || hours > 12) {
          throw new Error(`Invalid time value: ${value}`);
        }
        if (period === "AM" && hours === 12) hours = 0;
        if (period === "PM" && hours !== 12) hours += 12;
      } else if (hours > 23) {
        throw new Error(`Invalid time value: ${value}`);
      }

      return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(seconds).padStart(2, "0"),
      ].join(":");
    };

    client = await db.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of attendance) {
      const studentId = Number(item.studentId);
      const status = item.status;

      if (!Number.isInteger(studentId) || studentId <= 0 ||
          !["Present", "Absent", "Holiday"].includes(status)) {
        skipped++;
        continue;
      }

      const subjectCode = item.subjectCode ?? item.subject_code ?? null;
      const startTime = toDbTime(item.startTime ?? item.start_time);
      const endTime = toDbTime(item.endTime ?? item.end_time);
      const stream = item.stream ?? null;
      const reason = item.reason ?? null;

      const studentCheck = await client.query(
        "SELECT id FROM students WHERE id = $1",
        [studentId]
      );

      if (!studentCheck.rowCount) {
        skipped++;
        continue;
      }

      const existing = await client.query(
        `SELECT id
         FROM attendance
         WHERE student_id = $1
           AND date::date = $2::date
           AND subject_code IS NOT DISTINCT FROM $3::text
           AND start_time IS NOT DISTINCT FROM $4::time
           AND end_time IS NOT DISTINCT FROM $5::time
         ORDER BY id DESC
         LIMIT 1`,
        [studentId, date, subjectCode, startTime, endTime]
      );

      if (existing.rowCount) {
        await client.query(
          `UPDATE attendance
           SET status = $1, stream = $2, reason = $3
           WHERE id = $4`,
          [status, stream, reason, existing.rows[0].id]
        );

        updated++;
      } else {
        await client.query(
          `INSERT INTO attendance
           (student_id, date, status, subject_code,
            start_time, end_time, stream, reason)
           VALUES ($1, $2::date, $3, $4, $5::time, $6::time, $7, $8)`,
          [studentId, date, status, subjectCode,
           startTime, endTime, stream, reason]
        );

        inserted++;
      }
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return res.json({
      success: true,
      message: "Attendance updated successfully",
      date,
      inserted,
      updated,
      skipped,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError.message);
      }
    }

    console.error("editAttendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to edit attendance",
      error: error.message,
      code: error.code || null,
    });
  } finally {
    if (client) client.release();
  }
};
// ============================================================
// 4. STUDENT: SUBJECT-WISE ATTENDANCE
// ============================================================

exports.getSubjectWiseAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "studentId is required",
      });
    }

    const { rows } = await db.query(
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
        AND UPPER(subject_code) NOT LIKE '%EXAM%'
        AND LOWER(TRIM(subject_code)) <> 'holiday'
      GROUP BY subject_code
      ORDER BY subject_code
      `,
      [studentId]
    );

    const subjects = rows.map((row) => {
      const present = Number(row.present);
      const absent = Number(row.absent);
      const total = Number(row.total);

      return {
        subjectCode: row.subject_code,
        present,
        absent,
        total,
        percentage: getAttendancePercentage(present, total),
      };
    });

    return res.json({
      success: true,
      studentId: Number(studentId),
      subjects,
    });
  } catch (error) {
    console.error("getSubjectWiseAttendance:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching subject-wise attendance",
    });
  }
};

// ============================================================
// 5. ADMIN: SHIFT STUDENT BATCH
// ============================================================

exports.shiftStudentBatch = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { batch } = req.body;

    if (!studentId || !batch) {
      return res.status(400).json({
        success: false,
        message: "Student ID and target batch are required",
      });
    }

    const normalizedBatch = normalizeBatch(batch);

    if (!["batch1", "batch2", "batch3"].includes(normalizedBatch)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch. Use batch1, batch2 or batch3",
      });
    }

    const studentResult = await db.query(
      `
      SELECT id, name, class, batch
      FROM students
      WHERE id = $1 AND role = 'student'
      `,
      [studentId]
    );

    if (!studentResult.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student = studentResult.rows[0];

    if (normalizeBatch(student.batch) === normalizedBatch) {
      return res.status(400).json({
        success: false,
        message: `${student.name} is already in ${normalizedBatch}`,
      });
    }

    const { rows } = await db.query(
      `
      UPDATE students
      SET batch = $1
      WHERE id = $2 AND role = 'student'
      RETURNING id, name, class, batch
      `,
      [normalizedBatch, studentId]
    );

    return res.json({
      success: true,
      message: `${student.name} shifted successfully to ${normalizedBatch}`,
      student: rows[0],
    });
  } catch (error) {
    console.error("shiftStudentBatch:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while shifting student batch",
    });
  }
};

// ============================================================
// 6. ADMIN: ALL STUDENTS SUBJECT-WISE ATTENDANCE FOR A MONTH
// ============================================================

exports.getAllStudentsSubjectWiseAttendance = async (req, res) => {
  try {
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: "month is required in YYYY-MM format",
      });
    }

    const { rows } = await db.query(
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
        AND UPPER(a.subject_code) NOT LIKE '%EXAM%'
        AND LOWER(TRIM(a.subject_code)) <> 'holiday'
        AND a.date >= TO_DATE($1, 'YYYY-MM')
        AND a.date < TO_DATE($1, 'YYYY-MM') + INTERVAL '1 month'

      WHERE s.role = 'student'

      GROUP BY
        s.id, s.name, s.class, s.batch, s.stream,
        a.subject_code

      ORDER BY s.class, s.name, a.subject_code
      `,
      [month]
    );

    const studentsMap = {};

    for (const row of rows) {
      const id = row.student_id;

      if (!studentsMap[id]) {
        studentsMap[id] = {
          studentId: Number(id),
          name: row.name,
          class: row.class,
          batch: row.batch,
          stream: row.stream,
          subjects: [],
        };
      }

      if (row.subject_code) {
        const present = Number(row.present);
        const absent = Number(row.absent);
        const total = Number(row.total);

        studentsMap[id].subjects.push({
          subjectCode: row.subject_code,
          present,
          absent,
          total,
          percentage: getAttendancePercentage(present, total),
        });
      }
    }

    const students = Object.values(studentsMap);

    return res.json({
      success: true,
      month,
      totalStudents: students.length,
      students,
    });
  } catch (error) {
    console.error("getAllStudentsSubjectWiseAttendance:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching monthly attendance",
    });
  }
};

// ============================================================
// 7. STUDENT: FULL ATTENDANCE HISTORY
// Includes subject, lecture times, exam records and holiday reason.
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

    const { rows } = await db.query(
      `
      SELECT
        id AS "attendanceId",
        date,
        subject_code AS "subjectCode",
        start_time AS "startTime",
        end_time AS "endTime",
        status,
        reason,
        stream

      FROM attendance
      WHERE student_id = $1

      ORDER BY date DESC, start_time DESC NULLS LAST, id DESC
      `,
      [id]
    );

    return res.json({
      success: true,
      attendance: rows,
    });
  } catch (error) {
    console.error("getStudentAttendance:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching records",
    });
  }
};

// ============================================================
// 8. ALL STUDENTS ATTENDANCE SUMMARY
// ============================================================

exports.getTodayAttendancePercent = async (req, res) => {
  try {
    const { rows } = await db.query(
      `
      SELECT
        s.id AS "studentId",
        s.name,
        s.class,

        COUNT(*) FILTER (
          WHERE a.status = 'Present'
        ) AS present,

        COUNT(*) FILTER (
          WHERE a.status IN ('Present', 'Absent')
        ) AS total

      FROM students s

      LEFT JOIN attendance a
        ON s.id = a.student_id

      WHERE s.role = 'student'

      GROUP BY s.id, s.name, s.class
      ORDER BY s.id
      `
    );

    const students = rows.map((row) => {
      const present = Number(row.present) || 0;
      const total = Number(row.total) || 0;
      const percentage = total === 0 ? 0 : (present / total) * 100;

      return {
        studentId: row.studentId,
        name: row.name,
        class: row.class,
        present,
        total,
        percentage: percentage.toFixed(2),
        marks: getAttendanceMarks(percentage),
      };
    });

    return res.json({
      success: true,
      date: getTodayDate(),
      students,
    });
  } catch (error) {
    console.error("getTodayAttendancePercent:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============================================================
// 9. ATTENDANCE MARKS - MONTHLY, OPTIONAL SUBJECT FILTER
// ============================================================

exports.getAttendanceMarks = async (req, res) => {
  try {
    const { studentId, month, subject_code } = req.query;

    if (!studentId || !month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: "Valid studentId and month (YYYY-MM) are required",
      });
    }

    const params = [
      Number(studentId),
      month,
    ];

    let subjectFilter = "";

    if (subject_code) {
      params.push(subject_code);
      subjectFilter = `AND subject_code = $3`;
    }

    const { rows } = await db.query(
      `
      SELECT status
      FROM attendance
      WHERE student_id = $1
        AND date >= TO_DATE($2, 'YYYY-MM')
        AND date < TO_DATE($2, 'YYYY-MM') + INTERVAL '1 month'
        ${subjectFilter}
      `,
      params
    );

    const validDays = rows.filter(
      (row) => ["Present", "Absent"].includes(row.status)
    ).length;

    const presentDays = rows.filter(
      (row) => row.status === "Present"
    ).length;

    const absentDays = validDays - presentDays;
    const percentage =
      validDays === 0 ? 0 : (presentDays / validDays) * 100;

    return res.json({
      success: true,
      studentId: Number(studentId),
      month,
      subject_code: subject_code || null,
      totalClasses: validDays,
      presentClasses: presentDays,
      absentClasses: absentDays,
      percentage: percentage.toFixed(2),
      attendanceMarks: getAttendanceMarks(percentage),
    });
  } catch (error) {
    console.error("getAttendanceMarks:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching attendance marks",
    });
  }
};

// ============================================================
// 10. ADMIN: STUDENT DROP + PROFILE EDIT REQUESTS
// ============================================================

exports.getAllStudentRequests = async (req, res) => {
  try {
    const { rows } = await db.query(
      `
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

      LEFT JOIN student_drop sd ON s.id = sd.student_id
      LEFT JOIN profile_edit_requests per ON s.id = per.student_id

      WHERE s.role = 'student'
      ORDER BY s.id DESC, per.requested_at DESC
      `
    );

    return res.json({
      success: true,
      students: rows,
    });
  } catch (error) {
    console.error("getAllStudentRequests:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching student requests",
    });
  }
};

// ============================================================
// 11. STUDENT: OWN DROP + PROFILE EDIT REQUESTS
// ============================================================

exports.getMyStudentRequests = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Student ID required",
      });
    }

    const { rows } = await db.query(
      `
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

      LEFT JOIN student_drop sd ON s.id = sd.student_id
      LEFT JOIN profile_edit_requests per ON s.id = per.student_id

      WHERE s.id = $1 AND s.role = 'student'
      ORDER BY per.requested_at DESC
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.json({
      success: true,
      student: rows,
    });
  } catch (error) {
    console.error("getMyStudentRequests:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching student data",
    });
  }
};

// ============================================================
// 12. ADMIN: FETCH ATTENDANCE / COMPLETED SCHEDULE FOR A DATE
// ============================================================

exports.fetchDoneSchedule = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date || !isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Valid date is required in YYYY-MM-DD format",
      });
    }

    const { rows } = await db.query(
      `
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
        a.status,
        a.reason

      FROM attendance a
      JOIN students s ON s.id = a.student_id

      WHERE a.date::date = $1::date

      ORDER BY a.start_time ASC NULLS LAST, s.name ASC
      `,
      [date]
    );

    return res.json({
      success: true,
      date,
      totalRecords: rows.length,
      attendance: rows,
    });
  } catch (error) {
    console.error("fetchDoneSchedule:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching records",
      error: error.message,
    });
  }
};

// ============================================================
// 13. STUDENT: FETCH OWN COMPLETED CLASSES / ATTENDANCE
// ============================================================

exports.fetchStudentDoneClassesSchedule = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required",
      });
    }

    const { rows } = await db.query(
      `
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
        a.status,
        a.reason

      FROM attendance a
      INNER JOIN students s ON s.id = a.student_id

      WHERE a.student_id = $1
        AND s.role = 'student'

      ORDER BY a.date DESC, a.start_time DESC NULLS LAST, a.id DESC
      `,
      [studentId]
    );

    return res.json({
      success: true,
      studentId: Number(studentId),
      totalRecords: rows.length,
      classes: rows,
    });
  } catch (error) {
    console.error("fetchStudentDoneClassesSchedule:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch student completed classes",
      error: error.message,
    });
  }
};
