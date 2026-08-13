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