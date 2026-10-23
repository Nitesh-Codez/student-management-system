const pool = require("../db"); // PostgreSQL pool

// ================= 1. SUBMIT FEEDBACK =================

const submitFeedback = async (req, res) => {
  try {
    const {
      student_id,
      month,
      year,
      teacher_id,
      subject,
      mcqAnswers,
      suggestion,
      rating,
      problem
    } = req.body;

    if (
      !student_id ||
      !teacher_id ||
      !subject ||
      !Array.isArray(mcqAnswers) ||
      mcqAnswers.length !== 10
    ) {
      return res.status(400).json({
        error: "Missing required fields or incomplete MCQs"
      });
    }

    // 1. Insert feedback with teacher and subject
    const feedbackResult = await pool.query(
      `INSERT INTO feedback
       (student_id, month, year, teacher_id, subject,
        suggestion, rating, problem, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id`,
      [
        student_id,
        month,
        year,
        teacher_id,
        subject,
        suggestion,
        rating,
        problem
      ]
    );

    const feedbackId = feedbackResult.rows[0].id;

    // 2. Insert MCQ answers
    const values = [];

    const placeholders = mcqAnswers.map((ans, i) => {
      values.push(feedbackId, i + 1, ans);
      const idx = i * 3;

      return `($${idx + 1}, $${idx + 2}, $${idx + 3})`;
    }).join(",");

    await pool.query(
      `INSERT INTO feedback_mcq_answers
       (feedback_id, question_number, answer)
       VALUES ${placeholders}`,
      values
    );

    res.json({
      success: true,
      message: "Feedback submitted successfully"
    });

  } catch (err) {
    console.error("FEEDBACK SUBMIT ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};



// ================= 2. GET FEEDBACK FOR A STUDENT =================
const getStudentFeedback = async (req, res) => {
  try {
    const { studentId } = req.params;

    const feedbacks = await pool.query(
      `SELECT f.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'question_number', m.question_number,
                    'answer', m.answer
                  ) ORDER BY m.question_number
                ) FILTER (WHERE m.id IS NOT NULL),
                '[]'
              ) AS mcq_answers
       FROM feedback f
       LEFT JOIN feedback_mcq_answers m
         ON f.id = m.feedback_id
       WHERE f.student_id = $1
       GROUP BY f.id
       ORDER BY f.year DESC, f.month DESC, f.id DESC`,
      [studentId]
    );

    res.json({
      success: true,
      feedbacks: feedbacks.rows
    });
  } catch (err) {
    console.error("GET STUDENT FEEDBACK ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};


// ================= 3. GET ALL FEEDBACK FOR ADMIN =================
const getAllFeedback = async (req, res) => {
  try {
    const feedbacks = await pool.query(
      `SELECT
          s.name,
          s.class,
          f.id,
          f.student_id,
          f.teacher_id,
          f.subject,
          f.month,
          f.year,
          f.suggestion,
          f.rating,
          f.problem,
          f.created_at,
          COALESCE(
            json_agg(
              json_build_object(
                'question_number', m.question_number,
                'answer', m.answer
              ) ORDER BY m.question_number
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'
          ) AS mcq_answers
       FROM feedback f
       JOIN students s ON f.student_id = s.id
       LEFT JOIN feedback_mcq_answers m
         ON f.id = m.feedback_id
       GROUP BY s.id, f.id
       ORDER BY f.year DESC, f.month DESC, f.id DESC`
    );

    res.json({
      success: true,
      feedbacks: feedbacks.rows
    });
  } catch (err) {
    console.error("GET ALL FEEDBACK ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};


// ================= 4. ADMIN SUMMARY (SENTIMENT BASED) =================
const getAdminFeedbackSummary = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          COUNT(*) AS total_answers,
          COUNT(*) FILTER (WHERE answer <= 2) AS positive_answers
       FROM feedback_mcq_answers`
    );

    const totalAnswers = Number(result.rows[0].total_answers);
    const positiveCount = Number(result.rows[0].positive_answers);

    const percentage = totalAnswers === 0
      ? 0
      : Math.round((positiveCount / totalAnswers) * 100);

    res.json({
      success: true,
      summary: {
        percentage,
        totalFeedback: totalAnswers,
        remark:
          percentage >= 85 ? "Excellent" :
          percentage >= 70 ? "Good" :
          percentage >= 50 ? "Average" :
          "Needs Improvement"
      }
    });
  } catch (err) {
    console.error("ADMIN SUMMARY ERROR:", err);
    res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
};



// GET TEACHERS BY CLASS FOR FEEDBACK
const getTeachersByClass = async (req, res) => {
  try {
    const { class_name } = req.params;

    const { rows } = await pool.query(
      `
      SELECT DISTINCT
        ta.teacher_id AS "teacherId",
        t.name AS "teacherName",
        t.profile_photo AS "teacherPhoto",
        ta.class_name AS "className",
        ta.subject_name AS "subjectName"
      FROM teacher_assignments ta
      LEFT JOIN teachers t
        ON ta.teacher_id = t.id
      WHERE ta.class_name = $1
      ORDER BY ta.subject_name
      `,
      [class_name]
    );

    return res.json({
      success: true,
      className: class_name,
      teachers: rows,
    });
    } catch (error) {
    console.error("getTeachersByClass:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch teachers",
    });
  }
}; // getTeachersByClass function close

module.exports = {
  submitFeedback,
  getStudentFeedback,
  getAllFeedback,
  getAdminFeedbackSummary,
  getTeachersByClass
};