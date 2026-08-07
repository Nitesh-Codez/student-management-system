const pool = require("../db");

// 1. Fetch Exam Details (Used by ExamForm AND Admit Card)
const getMyExamDetails = async (req, res) => {
  try {
    const { student_id, exam_type } = req.query;

    if (!student_id || !exam_type) {
      return res.status(400).json({
        success: false,
        message: "student_id and exam_type are required."
      });
    }

    const query = `
      SELECT
        student_id,
        student_name,
        student_class,
        exam_type,
        session_year,
        subjects,
        status,
        applied_at
      FROM exam_registrations
      WHERE student_id = $1
      AND exam_type = $2
      LIMIT 1
    `;

    const { rows } = await pool.query(query, [student_id, exam_type]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Exam form not found for this student."
      });
    }

    return res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error("Fetch Exam Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

// 2. Finalize Exam Submission
const finalizeExamSubmission = async (req, res) => {
  try {
    const { student_id, student_name, student_class, session_year, exam_type, subjects } = req.body;

    if (!student_id || !exam_type) {
      return res.status(400).json({
        success: false,
        message: "student_id and exam_type are required."
      });
    }

    const currentSession = session_year || "2026-2027";

    const query = `
      INSERT INTO exam_registrations (student_id, student_name, student_class, session_year, exam_type, subjects, status, applied_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'Submitted', NOW())
      ON CONFLICT (student_id, exam_type, session_year) 
      DO UPDATE SET 
        status = 'Submitted',
        subjects = EXCLUDED.subjects,
        applied_at = NOW()
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      student_id, 
      student_name || 'N/A', 
      student_class || 'N/A', 
      currentSession, 
      exam_type, 
      subjects
    ]);

    return res.json({
      success: true,
      message: "Exam Form Submitted Successfully!",
      data: rows[0]
    });

  } catch (error) {
    console.error("Submit Exam Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};
// 3. Get My Subjects
const getMySubjects = async (req, res) => {
  try {
    const { student_id, exam_type } = req.query;

    if (!student_id || !exam_type) {
      return res.status(400).json({
        success: false,
        message: "student_id and exam_type are required."
      });
    }

    const query = `
      SELECT
        student_name,
        student_class,
        exam_type,
        subjects
      FROM exam_registrations
      WHERE student_id = $1
      AND exam_type = $2
      LIMIT 1
    `;

    const { rows } = await pool.query(query, [student_id, exam_type]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Subjects not found."
      });
    }

    let subjects = rows[0].subjects;

    // Agar PostgreSQL array hai to as it is
    // Agar comma separated string hai to array bana do
    if (typeof subjects === "string") {
      subjects = subjects
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return res.json({
      success: true,
      student_name: rows[0].student_name,
      student_class: rows[0].student_class,
      exam_type: rows[0].exam_type,
      subjects
    });

  } catch (error) {
    console.error("Get Subjects Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

//Admin Check All Exam Forms
// 4. Get All Submitted Exam Forms (Admin)
const getTotalExamSubmissions = async (req, res) => {
  try {
    const query = `
      SELECT
        id,
        student_id,
        student_name,
        student_class,
        exam_type,
        session_year,
        status,
        applied_at
      FROM exam_registrations
      WHERE status = 'Submitted'
      ORDER BY applied_at DESC;
    `;

    const { rows } = await pool.query(query);

    return res.json({
      success: true,
      total_submissions: rows.length,
      students: rows,
    });

  } catch (error) {
    console.error("Get Submitted Exam Forms Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  getTotalExamSubmissions,
};
module.exports = {
  getMyExamDetails,
  finalizeExamSubmission,
  getMySubjects,
  getTotalExamSubmissions
};