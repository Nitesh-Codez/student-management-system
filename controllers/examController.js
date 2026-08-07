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
    const { student_id, exam_type } = req.body;

    if (!student_id || !exam_type) {
      return res.status(400).json({
        success: false,
        message: "student_id and exam_type are required."
      });
    }

    const query = `
      UPDATE exam_registrations
      SET
        status = 'Submitted',
        applied_at = NOW()
      WHERE student_id = $1
      AND exam_type = $2
      RETURNING *
    `;

    const { rows } = await pool.query(query, [student_id, exam_type]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No registration record found to update."
      });
    }

    return res.json({
      success: true,
      message: "Exam Form Submitted Successfully!",
      data: rows[0]
    });

  } catch (error) {
    console.error("Submit Exam Error:", error);

    // Duplicate Entry (Unique Constraint)
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Exam registration already exists."
      });
    }

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

module.exports = {
  getMyExamDetails,
  finalizeExamSubmission,
  getMySubjects
};