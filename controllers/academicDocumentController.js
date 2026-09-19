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
// Single / Multiple Months
// Attendance + Marks + Assignments + Submissions
// ============================================================
const getStudentMonthlyReport = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { month } = req.query;

    if (!studentId || !month) {
      return res.status(400).json({
        success: false,
        message:
          "studentId and month are required. Example: ?month=2026-08 or ?month=2026-08,2026-09",
      });
    }

    // ========================================================
    // MONTHS
    // Supports:
    // ?month=2026-08
    // ?month=2026-08,2026-09
    // ========================================================
    const months = month
      .split(",")
      .map(m => m.trim())
      .filter(Boolean);

    if (!months.length || months.some(m => !/^\d{4}-\d{2}$/.test(m))) {
      return res.status(400).json({
        success: false,
        message:
          "Month must be in YYYY-MM format. Multiple months: 2026-08,2026-09",
      });
    }

    // Remove duplicate months
    const selectedMonths = [...new Set(months)].sort();

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

    // ========================================================
    // DATE RANGE
    // First selected month -> first date
    // Last selected month -> next month first date
    // ========================================================
    const startDate = `${selectedMonths[0]}-01`;

    const lastMonth = selectedMonths[selectedMonths.length - 1];

    const [lastYear, lastMonthNumber] = lastMonth
      .split("-")
      .map(Number);

    const endYear =
      lastMonthNumber === 12 ? lastYear + 1 : lastYear;

    const endMonth =
      lastMonthNumber === 12 ? 1 : lastMonthNumber + 1;

    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    // ========================================================
    // 2. ATTENDANCE
    // ========================================================
    const attendanceResult = await db.query(
      `
      SELECT
        date::date AS date,
        status
      FROM attendance
      WHERE student_id = $1
        AND date::date >= $2
        AND date::date < $3
      ORDER BY date::date ASC
      `,
      [studentId, startDate, endDate]
    );

    const attendance = attendanceResult.rows;

    // ========================================================
    // ATTENDANCE SUMMARY FUNCTION
    // ========================================================
    const getAttendanceSummary = records => {
      const present = records.filter(
        a => a.status === "Present"
      ).length;

      const absent = records.filter(
        a => a.status === "Absent"
      ).length;

      const holiday = records.filter(
        a => a.status === "Holiday"
      ).length;

      const total = present + absent + holiday;

      const workingDays = present + absent;

      const percentage =
        workingDays > 0
          ? Number(((present / workingDays) * 100).toFixed(2))
          : 0;

      return {
        P: present,
        A: absent,
        H: holiday,

        // Also keeping readable names
        present,
        absent,
        holiday,

        total,
        workingDays,
        percentage,
      };
    };

    // ========================================================
    // MONTH-WISE ATTENDANCE
    // ========================================================
    const monthlyAttendance = selectedMonths.map(m => {
      const records = attendance.filter(a => {
        const d = new Date(a.date);
        const recordMonth = `${d.getFullYear()}-${String(
          d.getMonth() + 1
        ).padStart(2, "0")}`;

        return recordMonth === m;
      });

      return {
        month: m,
        summary: getAttendanceSummary(records),
        records,
      };
    });

    // Overall attendance for all selected months
    const attendanceSummary = getAttendanceSummary(attendance);

    // ========================================================
    // 3. MARKS
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
        AND test_date < $3
      ORDER BY test_date ASC
      `,
      [studentId, startDate, endDate]
    );

    const marks = marksResult.rows;

    // ========================================================
    // MONTH-WISE MARKS
    // ========================================================
    const monthlyMarks = selectedMonths.map(m => ({
      month: m,
      totalTests: marks.filter(mark => {
        const d = new Date(mark.test_date);

        const recordMonth = `${d.getFullYear()}-${String(
          d.getMonth() + 1
        ).padStart(2, "0")}`;

        return recordMonth === m;
      }).length,

      records: marks.filter(mark => {
        const d = new Date(mark.test_date);

        const recordMonth = `${d.getFullYear()}-${String(
          d.getMonth() + 1
        ).padStart(2, "0")}`;

        return recordMonth === m;
      }),
    }));

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
          WHEN s.id IS NOT NULL
          THEN 'SUBMITTED'
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
        AND a.uploaded_at < $5

      ORDER BY a.uploaded_at ASC
      `,
      [
        studentId,
        student.class,
        student.session,
        startDate,
        endDate,
      ]
    );

    const assignments = assignmentResult.rows;

    // ========================================================
    // ASSIGNMENT SUMMARY
    // ========================================================
    const getAssignmentSummary = records => ({
      assigned: records.length,

      submitted: records.filter(
        a => a.status === "SUBMITTED"
      ).length,

      pending: records.filter(
        a => a.status === "PENDING"
      ).length,
    });

    const assignmentSummary =
      getAssignmentSummary(assignments);

    // ========================================================
    // MONTH-WISE ASSIGNMENTS
    // ========================================================
    const monthlyAssignments = selectedMonths.map(m => {
      const records = assignments.filter(a => {
        const d = new Date(a.assigned_at);

        const recordMonth = `${d.getFullYear()}-${String(
          d.getMonth() + 1
        ).padStart(2, "0")}`;

        return recordMonth === m;
      });

      return {
        month: m,
        summary: getAssignmentSummary(records),
        records,
      };
    });

    // ========================================================
    // 5. FINAL RESPONSE
    // ========================================================
    return res.json({
      success: true,

      // Selected months
      months: selectedMonths,

      period: {
        from: startDate,
        to: endDate,
      },

      student: {
        id: student.id,
        name: student.name,
        class: student.class,
        batch: student.batch,
        session: student.session,
        email: student.email,
      },

      // ======================================================
      // OVERALL SELECTED MONTHS
      // ======================================================
      overall: {
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
      },

      // ======================================================
      // MONTH-WISE COMPLETE REPORT
      // ======================================================
      monthly: selectedMonths.map(m => {
        const attendanceData = monthlyAttendance.find(
          x => x.month === m
        );

        const marksData = monthlyMarks.find(
          x => x.month === m
        );

        const assignmentData = monthlyAssignments.find(
          x => x.month === m
        );

        return {
          month: m,

          attendance: attendanceData,

          marks: marksData,

          assignments: assignmentData,
        };
      }),
    });
  } catch (error) {
    console.error(
      "Student Monthly Report Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Server error while generating student monthly report",
    });
  }
};

module.exports = {
  uploadExamDocument,
  getExamDocuments,
  deleteExamDocument,
  getStudentMonthlyReport
};