const pool = require("../db"); // PostgreSQL pool

// ================= SUBMIT FEEDBACK =================
const submitFeedback = async (req, res) => {
  try {
    const { student_id, month, year, mcqAnswers, suggestion, rating, problem } = req.body;

    if (!student_id || !mcqAnswers || mcqAnswers.length !== 10) {
      return res.status(400).json({ error: "Missing required fields or incomplete MCQs" });
    }

    // 1️⃣ Insert feedback row
    const feedbackResult = await pool.query(
      `INSERT INTO feedback (student_id, month, year, suggestion, rating, problem, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       RETURNING id`,
      [student_id, month, year, suggestion, rating, problem]
    );

    const feedbackId = feedbackResult.rows[0].id;

    // 2️⃣ Insert MCQ answers
    const mcqQuery = `INSERT INTO feedback_mcq_answers (feedback_id, question_number, answer) VALUES `;
    const values = [];
    const placeholders = mcqAnswers.map((ans, i) => {
      values.push(feedbackId, i + 1, ans); // question_number = i+1
      const idx = i * 3;
      return `($${idx + 1}, $${idx + 2}, $${idx + 3})`;
    }).join(",");

    await pool.query(mcqQuery + placeholders, values);

    res.json({ success: true, message: "Feedback submitted successfully" });
  } catch (err) {
    console.error("FEEDBACK SUBMIT ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ================= GET FEEDBACK FOR A STUDENT =================
const getStudentFeedback = async (req, res) => {
  try {
    const { studentId } = req.params;
    const feedbacks = await pool.query(
      `SELECT f.*,
              COALESCE(json_agg(json_build_object('question_number', m.question_number, 'answer', m.answer)) 
                       FILTER (WHERE m.id IS NOT NULL), '[]') AS mcq_answers
       FROM feedback f
       LEFT JOIN feedback_mcq_answers m ON f.id = m.feedback_id
       WHERE f.student_id=$1
       GROUP BY f.id
       ORDER BY f.year DESC, f.month DESC`,
      [studentId]
    );
    res.json({ success: true, feedbacks: feedbacks.rows });
  } catch (err) {
    console.error("GET STUDENT FEEDBACK ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ================= GET ALL FEEDBACK FOR ADMIN =================
const getAllFeedback = async (req, res) => {
  try {
    const feedbacks = await pool.query(
      `SELECT 
         s.name, 
         s.class, 
         f.id,
         f.student_id,
         f.month, 
         f.year, 
         f.suggestion, 
         f.rating, 
         f.problem,
         COALESCE(
           json_agg(
             json_build_object(
               'question_number', m.question_number, 
               'answer', m.answer
             )
           ) FILTER (WHERE m.id IS NOT NULL), '[]'
         ) AS mcq_answers
       FROM feedback f
       JOIN students s ON f.student_id = s.id
       LEFT JOIN feedback_mcq_answers m ON f.id = m.feedback_id
       GROUP BY s.id, f.id
       ORDER BY f.year DESC, f.month DESC`
    );

    // Convert mcq_answers string to array for safety
    const parsedFeedbacks = feedbacks.rows.map(f => ({
      ...f,
      mcq_answers: Array.isArray(f.mcq_answers) ? f.mcq_answers : JSON.parse(f.mcq_answers)
    }));

    res.json({ success: true, feedbacks: parsedFeedbacks });
  } catch (err) {
    console.error("GET ALL FEEDBACK ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};
// ================= ADMIN FEEDBACK SUMMARY =================
// ================= ADMIN FEEDBACK SUMMARY (WEIGHTED) =================
const getAdminFeedbackSummary = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT answer
      FROM feedback_mcq_answers
    `);

    let totalScore = 0;
    let maxScore = 0;

    result.rows.forEach(row => {
      const answer = row.answer; // 1 to 4

      // Reverse weight: 1 is best
      let score = 0;
      if (answer === 1) score = 4;
      else if (answer === 2) score = 3;
      else if (answer === 3) score = 2;
      else if (answer === 4) score = 1;

      totalScore += score;
      maxScore += 4;
    });

    const percentage = maxScore === 0
      ? 0
      : Math.round((totalScore / maxScore) * 100);

    res.json({
      success: true,
      summary: {
        percentage,
        totalScore,
        maxScore,
        remark:
          percentage >= 85 ? "Excellent" :
          percentage >= 70 ? "Good" :
          percentage >= 50 ? "Average" :
          "Needs Improvement"
      }
    });

  } catch (err) {
    console.error("ADMIN SUMMARY ERROR:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

module.exports = { submitFeedback, getStudentFeedback, getAllFeedback, getAdminFeedbackSummary };
