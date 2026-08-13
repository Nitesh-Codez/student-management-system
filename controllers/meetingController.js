const db = require("../db");

// ========================================
// ADMIN - CREATE MEETING
// ========================================
exports.createMeeting = async (req, res) => {
  try {
    const {
      title,
      meeting_type,
      topic,
      meeting_link,
      meeting_date,
      start_time,
      end_time,
      duration_minutes,
      session
    } = req.body;

    if (
      !title ||
      !meeting_type ||
      !meeting_link ||
      !meeting_date ||
      !start_time
    ) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing"
      });
    }

    const result = await db.query(
      `INSERT INTO meetings
      (
        title,
        meeting_type,
        topic,
        meeting_link,
        meeting_date,
        start_time,
        end_time,
        duration_minutes,
        session,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        title,
        meeting_type,
        topic || null,
        meeting_link,
        meeting_date,
        start_time,
        end_time || null,
        duration_minutes || null,
        session || "2026-2027",
        req.user?.id || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Meeting created successfully",
      meeting: result.rows[0]
    });

  } catch (error) {
    console.error("CREATE MEETING ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create meeting"
    });
  }
};


// ========================================
// ADMIN - GET ALL MEETINGS
// ========================================
exports.getAllMeetings = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM meetings
      ORDER BY meeting_date DESC, start_time DESC
    `);

    res.json({
      success: true,
      meetings: result.rows
    });

  } catch (error) {
    console.error("GET MEETINGS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch meetings"
    });
  }
};


// ========================================
// STUDENT - GET MEETINGS
// ========================================
exports.getStudentMeetings = async (req, res) => {
  try {
    const { type } = req.query;

    const result = await db.query(
      `SELECT
        m.*,
        CASE
          WHEN ma.id IS NOT NULL THEN true
          ELSE false
        END AS attended,
        COALESCE(ma.duration_minutes, 0) AS attended_minutes,
        ma.attendance_status
      FROM meetings m
      LEFT JOIN meeting_attendance ma
        ON m.id = ma.meeting_id
        AND ma.student_id = $1
      WHERE m.meeting_type = $2
      AND m.session = '2026-2027'
      AND m.status != 'CANCELLED'
      ORDER BY m.meeting_date DESC, m.start_time DESC`,
      [
        req.user.id,
        type
      ]
    );

    res.json({
      success: true,
      meetings: result.rows
    });

  } catch (error) {
    console.error("STUDENT MEETINGS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch meetings"
    });
  }
};


// ========================================
// STUDENT - MARK ATTENDANCE
// ========================================
exports.markAttendance = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const {
      duration_minutes,
      remarks
    } = req.body;

    const meeting = await db.query(
      `SELECT *
       FROM meetings
       WHERE id = $1`,
      [meetingId]
    );

    if (meeting.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found"
      });
    }

    const m = meeting.rows[0];

    const existing = await db.query(
      `SELECT id
       FROM meeting_attendance
       WHERE meeting_id = $1
       AND student_id = $2`,
      [meetingId, req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Attendance already marked"
      });
    }

    const minutes = Number(duration_minutes) || 0;

    let attendanceStatus = "ATTENDED";

    if (
      m.duration_minutes &&
      minutes < Math.ceil(m.duration_minutes * 0.5)
    ) {
      attendanceStatus = "PARTIAL";
    }

    const result = await db.query(
      `INSERT INTO meeting_attendance
      (
        meeting_id,
        student_id,
        student_name,
        duration_minutes,
        attendance_status,
        remarks
      )
      SELECT
        $1,
        s.id,
        s.name,
        $3,
        $4,
        $5
      FROM students s
      WHERE s.id = $2
      RETURNING *`,
      [
        meetingId,
        req.user.id,
        minutes,
        attendanceStatus,
        remarks || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      attendance: result.rows[0]
    });

  } catch (error) {
    console.error("MARK ATTENDANCE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to mark attendance"
    });
  }
};


// ========================================
// ADMIN - GET MEETING ATTENDANCE
// ========================================
exports.getMeetingAttendance = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const result = await db.query(
      `SELECT
        ma.*,
        s.name,
        s."class"
      FROM meeting_attendance ma
      JOIN students s
        ON s.id = ma.student_id
      WHERE ma.meeting_id = $1
      ORDER BY ma.duration_minutes DESC`,
      [meetingId]
    );

    res.json({
      success: true,
      attendance: result.rows
    });

  } catch (error) {
    console.error("MEETING ATTENDANCE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch attendance"
    });
  }
};







// Agar type nahi diya hai -> STUDENTS + PARENTS dono
// ========================================
exports.getStudentMeetings = async (req, res) => {
  try {
    const { type } = req.query;

    let query = `
      SELECT
        m.id,
        m.title,
        m.meeting_type,
        m.topic,
        m.meeting_link,
        m.meeting_date,
        m.start_time,
        m.end_time,
        m.duration_minutes,
        m.session,
        m.status,
        m.created_at,

        CASE
          WHEN ma.id IS NOT NULL THEN true
          ELSE false
        END AS attended,

        COALESCE(ma.duration_minutes, 0) AS attended_minutes,

        COALESCE(ma.attendance_status, 'ABSENT')
          AS attendance_status

      FROM meetings m

      LEFT JOIN meeting_attendance ma
        ON m.id = ma.meeting_id
        AND ma.student_id = $1

      WHERE m.session = '2026-2027'
        AND m.status != 'CANCELLED'
    `;

    const params = [req.user.id];

    // Agar type diya hai to sirf wahi meetings
    if (type) {
      query += ` AND UPPER(m.meeting_type) = UPPER($2)`;
      params.push(type);
    }

    query += `
      ORDER BY
        m.meeting_date DESC,
        m.start_time DESC
    `;

    const result = await db.query(query, params);

    res.json({
      success: true,
      meetings: result.rows
    });

  } catch (error) {
    console.error("STUDENT MEETINGS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch meetings"
    });
  }
};


// ========================================
// STUDENT - MARK ATTENDANCE
// ========================================
// POST /meeting/student/:meetingId/attendance
//
// Student meeting JOIN karega
// -> attendance automatically create hogi
// -> status = PRESENT
// ========================================
exports.markAttendance = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const studentId = req.user.id;

    // ----------------------------------------
    // CHECK MEETING
    // ----------------------------------------
    const meetingResult = await db.query(
      `SELECT *
       FROM meetings
       WHERE id = $1
       AND status != 'CANCELLED'`,
      [meetingId]
    );

    if (meetingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found or cancelled"
      });
    }

    const meeting = meetingResult.rows[0];

    // ----------------------------------------
    // CHECK STUDENT
    // ----------------------------------------
    const studentResult = await db.query(
      `SELECT id, name
       FROM students
       WHERE id = $1`,
      [studentId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    const student = studentResult.rows[0];

    // ----------------------------------------
    // CHECK ALREADY ATTENDED
    // ----------------------------------------
    const existing = await db.query(
      `SELECT *
       FROM meeting_attendance
       WHERE meeting_id = $1
       AND student_id = $2`,
      [meetingId, studentId]
    );

    if (existing.rows.length > 0) {
      return res.json({
        success: true,
        alreadyMarked: true,
        message: "Attendance already marked",
        attendance: existing.rows[0]
      });
    }

    // ----------------------------------------
    // MARK PRESENT
    // ----------------------------------------
    const result = await db.query(
      `INSERT INTO meeting_attendance
      (
        meeting_id,
        student_id,
        student_name,
        duration_minutes,
        attendance_status,
        remarks
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        meetingId,
        studentId,
        student.name,
        0,
        "PRESENT",
        "Student joined the meeting"
      ]
    );

    res.status(201).json({
      success: true,
      message: "Attendance marked PRESENT",
      attendance: result.rows[0],
      meeting_link: meeting.meeting_link
    });

  } catch (error) {
    console.error("MARK ATTENDANCE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to mark attendance"
    });
  }
};


// ========================================
// ADMIN - GET MEETING ATTENDANCE
// ========================================
exports.getMeetingAttendance = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const result = await db.query(
      `SELECT
        ma.id,
        ma.meeting_id,
        ma.student_id,
        ma.student_name,
        ma.duration_minutes,
        ma.attendance_status,
        ma.remarks,
        ma.created_at,

        s."class"

      FROM meeting_attendance ma

      JOIN students s
        ON s.id = ma.student_id

      WHERE ma.meeting_id = $1

      ORDER BY ma.created_at DESC`,
      [meetingId]
    );

    res.json({
      success: true,
      attendance: result.rows
    });

  } catch (error) {
    console.error("MEETING ATTENDANCE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch attendance"
    });
  }
};