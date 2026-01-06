const pool = require("../db"); // PostgreSQL pool

// Submit feedback (student)
const submitFeedback = async (req, res) => {
  try {
    const { student_id, month, year, mcqAnswers, suggestion, rating, problem } = req.body;

    // Insert feedback row
    const feedbackResult = await pool.query(
      `INSERT INTO feedback (student_id, month, year, suggestion, rating, problem)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [student_id, month, year, suggestion, rating, problem]
    );

    const feedbackId = feedbackResult.rows[0].id;

    // Insert MCQ answers
    const mcqQuery = `INSERT INTO feedback_mcq_answers (feedback_id, question_number, answer) VALUES `;
    const values = [];
    const placeholders = mcqAnswers.map((ans, i) => {
      values.push(feedbackId, i + 1, ans); // question_number = i+1
      return `($${values.length - 2 + 1}, $${values.length - 1 + 1}, $${values.length})`;
    }).join(",");

    await pool.query(mcqQuery + placeholders, values);

    res.json({ message: "Feedback submitted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get feedback for a single student
const getStudentFeedback = async (req, res) => {
  try {
    const { studentId } = req.params;
    const feedbacks = await pool.query(
      `SELECT f.*,
              json_agg(json_build_object('question_number', m.question_number, 'answer', m.answer)) AS mcq_answers
       FROM feedback f
       LEFT JOIN feedback_mcq_answers m ON f.id = m.feedback_id
       WHERE f.student_id=$1
       GROUP BY f.id
       ORDER BY f.year DESC, f.month DESC`,
      [studentId]
    );
    res.json(feedbacks.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get all feedback for admin
const getAllFeedback = async (req, res) => {
  try {
    const feedbacks = await pool.query(
      `SELECT s.name, s.class, f.*,
              json_agg(json_build_object('question_number', m.question_number, 'answer', m.answer)) AS mcq_answers
       FROM feedback f
       JOIN students s ON f.student_id = s.id
       LEFT JOIN feedback_mcq_answers m ON f.id = m.feedback_id
       GROUP BY s.id, f.id
       ORDER BY f.year DESC, f.month DESC`
    );
    res.json(feedbacks.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { submitFeedback, getStudentFeedback, getAllFeedback };
