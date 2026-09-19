const db = require("../db");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "assignments";

// ================= UPLOAD EXAM DOCUMENT =================
const uploadExamDocument = async (req, res) => {
  try {
    const {
      exam_type,
      class_name,
      title,
      document_type
    } = req.body;

    if (!req.file || !exam_type || !class_name || !title || !document_type) {
      return res.status(400).json({
        success: false,
        message: "File, exam type, class, title and document type are required"
      });
    }

    // Only PDF + Images
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Only PDF, JPG, JPEG, PNG and WEBP files are allowed"
      });
    }

    // Only TIMETABLE / SYLLABUS
    if (!["TIMETABLE", "SYLLABUS"].includes(document_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document type"
      });
    }

    const fileName = `${Date.now()}-${req.file.originalname}`;

    const folder = `academic/${document_type.toLowerCase()}/class-${class_name}/${exam_type}`;

    const filePath = `${folder}/${fileName}`;

    // Upload to existing assignments bucket
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    // Public URL
    const { data } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

    const fileType =
      req.file.mimetype === "application/pdf"
        ? "PDF"
        : "IMAGE";

    // Save DB
    const { rows } = await db.query(
      `INSERT INTO academic_documents
      (
        exam_type,
        class_name,
        title,
        document_type,
        file_path,
        file_type,
        session
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        exam_type,
        class_name,
        title,
        document_type,
        publicUrl,
        fileType,
        "2026-27"
      ]
    );

    res.status(201).json({
      success: true,
      message: "Exam document uploaded successfully",
      data: rows[0]
    });

  } catch (error) {
    console.error("UPLOAD EXAM DOCUMENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/// ================= GET EXAM DOCUMENTS =================
const getExamDocuments = async (req, res) => {
  try {
    const {
      exam_type,
      class_name,
      document_type
    } = req.query;

    // Class is required
    if (!class_name) {
      return res.status(400).json({
        success: false,
        message: "class_name is required"
      });
    }

    let query = `
      SELECT *
      FROM academic_documents
      WHERE session = '2026-27'
      AND class_name = $1
    `;

    const values = [class_name];
    let index = 2;

    if (exam_type) {
      query += ` AND exam_type = $${index}`;
      values.push(exam_type);
      index++;
    }

    if (document_type) {
      query += ` AND document_type = $${index}`;
      values.push(document_type);
      index++;
    }

    query += ` ORDER BY uploaded_at DESC`;

    const { rows } = await db.query(query, values);

    res.json({
      success: true,
      total: rows.length,
      data: rows
    });

  } catch (error) {
    console.error("GET EXAM DOCUMENTS ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ================= DELETE EXAM DOCUMENT =================
const deleteExamDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      `SELECT file_path FROM academic_documents WHERE id = $1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    const fileUrl = rows[0].file_path;

    // Extract storage path from public URL
    const marker = `/storage/v1/object/public/${BUCKET}/`;

    const filePath = fileUrl.includes(marker)
      ? fileUrl.split(marker)[1]
      : null;

    if (filePath) {
      await supabase.storage
        .from(BUCKET)
        .remove([filePath]);
    }

    await db.query(
      `DELETE FROM academic_documents WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: "Exam document deleted successfully"
    });

  } catch (error) {
    console.error("DELETE EXAM DOCUMENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};







// ============================================================
// GET COMPLETE STUDENT MONTHLY REPORT
// Attendance + Marks + Assignments + Submissions
// ============================================================
const getStudentMonthlyReport = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { month } = req.query; // YYYY-MM

    if (!studentId || !month) {
      return res.status(400).json({
        success: false,
        message: "studentId and month are required (YYYY-MM)",
      });
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: "Month must be in YYYY-MM format",
      });
    }

    // ========================================================
    // 1. STUDENT DETAILS
    // ========================================================
    const studentResult = await db.query(
      `
      SELECT id, name, class, batch, session, email
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

    const startDate = `${month}-01`;
    const endDate = `(DATE '${startDate}' + INTERVAL '1 month')::date`;

    // ========================================================
    // 2. ATTENDANCE REPORT
    // ========================================================
    const attendanceResult = await db.query(
      `
      SELECT
        date::date AS date,
        status
      FROM attendance
      WHERE student_id = $1
        AND date::date >= $2
        AND date::date < ${endDate}
      ORDER BY date::date ASC
      `,
      [studentId, startDate]
    );

    const attendance = attendanceResult.rows;

    const attendanceSummary = {
      present: attendance.filter(a => a.status === "Present").length,
      absent: attendance.filter(a => a.status === "Absent").length,
      holiday: attendance.filter(a => a.status === "Holiday").length,
    };

    attendanceSummary.total =
      attendanceSummary.present +
      attendanceSummary.absent +
      attendanceSummary.holiday;

    const workingDays =
      attendanceSummary.present + attendanceSummary.absent;

    attendanceSummary.percentage =
      workingDays > 0
        ? Number(
            ((attendanceSummary.present / workingDays) * 100).toFixed(2)
          )
        : 0;

    // ========================================================
    // 3. MARKS FOR SELECTED MONTH
    // ========================================================
    const marksResult = await db.query(
      `
      SELECT
        id,
        subject,
        total_marks,
        obtained_marks,
        test_date,
        CASE
          WHEN obtained_marks >= total_marks * 0.33
          THEN 'Pass'
          ELSE 'Fail'
        END AS status
      FROM marks
      WHERE student_id = $1
        AND test_date >= $2
        AND test_date < ${endDate}
      ORDER BY test_date ASC
      `,
      [studentId, startDate]
    );

    const marks = marksResult.rows;

    // ========================================================
    // 4. ASSIGNMENTS + SUBMISSIONS
    // ========================================================
    const assignmentResult = await db.query(
      `
      SELECT
        a.id AS assignment_id,
        a.task_title,
        a.subject,
        a.class,
        a.deadline,
        a.uploaded_at AS assigned_at,

        s.id AS submission_id,
        s.uploaded_at AS submitted_at,
        s.rating,

        CASE
          WHEN s.id IS NOT NULL THEN 'SUBMITTED'
          ELSE 'PENDING'
        END AS status

      FROM assignment_uploads a

      LEFT JOIN assignment_uploads s
        ON s.task_title = a.task_title
       AND s.class = a.class
       AND s.uploader_role = 'student'
       AND s.student_id = $1

      WHERE a.uploader_role = 'admin'
        AND a.class = $2
        AND a.session = $3
        AND a.uploaded_at >= $4
        AND a.uploaded_at < ${endDate}

      ORDER BY a.uploaded_at ASC
      `,
      [
        studentId,
        student.class,
        student.session,
        startDate,
      ]
    );

    const assignments = assignmentResult.rows;

    const assignmentSummary = {
      assigned: assignments.length,
      submitted: assignments.filter(
        a => a.status === "SUBMITTED"
      ).length,
      pending: assignments.filter(
        a => a.status === "PENDING"
      ).length,
    };

    // ========================================================
    // 5. FINAL RESPONSE
    // ========================================================
    return res.json({
      success: true,

      month,

      student: {
        id: student.id,
        name: student.name,
        class: student.class,
        batch: student.batch,
        session: student.session,
        email: student.email,
      },

      attendance: {
        summary: attendanceSummary,
        records: attendance,
      },

      marks: {
        totalTests: marks.length,
        records: marks,
      },

      assignments: {
        summary: assignmentSummary,
        records: assignments,
      },
    });

  } catch (error) {
    console.error(
      "Student Monthly Report Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error while generating student monthly report",
    });
  }
};

module.exports = {
  uploadExamDocument,
  getExamDocuments,
  deleteExamDocument,
  getStudentMonthlyReport
};