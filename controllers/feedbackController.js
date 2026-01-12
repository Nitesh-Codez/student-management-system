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
const getAdminFeedbackSummary = async (req, res) => {
  try {
    // Fetch all MCQ answers
    const mcqRes = await pool.query(`SELECT answer FROM feedback_mcq_answers`);
    const allAnswers = mcqRes.rows.map(r => r.answer);

    // Count based on positive/neutral/negative
    let positive = 0, neutral = 0, negative = 0;

    allAnswers.forEach(a => {
      if ([1, 2].includes(a)) positive++;
      else if ([3].includes(a)) neutral++;
      else if ([4].includes(a)) negative++;
    });

    res.json({
      success: true,
      summary: { positive, neutral, negative }
    });
  } catch (err) {
    console.error("ADMIN SUMMARY ERROR:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

module.exports = { submitFeedback, getStudentFeedback, getAllFeedback, getAdminFeedbackSummary };
