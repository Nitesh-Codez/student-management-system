const db = require("../db");


// ✅ Create Quiz (Admin)
export const createQuiz = async (req, res) => {
  try {
    const { class_name, subject, title, timer_minutes, questions } = req.body;

    const total_marks = questions.length;

    const result = await pool.query(
      `INSERT INTO quizzes 
      (class_name, subject, title, timer_minutes, questions, total_marks)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [class_name, subject, title, timer_minutes, JSON.stringify(questions), total_marks]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ✅ Get Quiz by Class (Student Dashboard)
export const getQuizByClass = async (req, res) => {
  try {
    const { class_name } = req.params;

    const result = await pool.query(
      `SELECT id, title, subject, timer_minutes 
       FROM quizzes WHERE class_name=$1`,
      [class_name]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ✅ Get Single Quiz
export const getSingleQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM quizzes WHERE id=$1`,
      [id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ✅ Submit Quiz
export const submitQuiz = async (req, res) => {
  try {
    const { student_id, quiz_id, answers } = req.body;

    const quizRes = await pool.query(
      `SELECT * FROM quizzes WHERE id=$1`,
      [quiz_id]
    );

    const quiz = quizRes.rows[0];
    const questions = quiz.questions;

    let score = 0;

    questions.forEach((q, index) => {
      if (answers[index] === q.correctAnswer) {
        score++;
      }
    });

    const percentage = (score / quiz.total_marks) * 100;

    let grade = "D";
    if (percentage >= 90) grade = "A+";
    else if (percentage >= 80) grade = "A";
    else if (percentage >= 70) grade = "B";
    else if (percentage >= 60) grade = "C";

    await pool.query(
      `INSERT INTO quiz_results 
      (student_id, quiz_id, score, percentage, grade)
      VALUES ($1,$2,$3,$4,$5)`,
      [student_id, quiz_id, score, percentage, grade]
    );

    res.json({ score, percentage, grade });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};