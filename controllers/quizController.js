const db = require("../db");

// ✅ Create Quiz (Admin)
exports.createQuiz = async (req, res) => {
  try {
    const { class_name, subject, title, timer_minutes, questions } = req.body;

    const total_marks = questions.length;

    const sql = `
      INSERT INTO quizzes 
      (class_name, subject, title, timer_minutes, questions, total_marks)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;

    const result = await db.query(sql, [
      class_name,
      subject,
      title,
      timer_minutes,
      JSON.stringify(questions),
      total_marks,
    ]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Get Quiz by Class (Student Dashboard)
exports.getQuizByClass = async (req, res) => {
  try {
    const { class_name } = req.params;

    const result = await db.query(
      `SELECT id, title, subject, timer_minutes 
       FROM quizzes WHERE class_name=$1`,
      [class_name]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Get Single Quiz
exports.getSingleQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`SELECT * FROM quizzes WHERE id=$1`, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Submit Quiz
exports.submitQuiz = async (req, res) => {
  try {
    const { student_id, quiz_id, answers } = req.body;

    const quizRes = await db.query(`SELECT * FROM quizzes WHERE id=$1`, [quiz_id]);

    if (quizRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    const quiz = quizRes.rows[0];
    const questions = quiz.questions; // Ensure this is parsed if stored as JSON string

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

    await db.query(
      `INSERT INTO quiz_results 
      (student_id, quiz_id, score, percentage, grade)
      VALUES ($1, $2, $3, $4, $5)`,
      [student_id, quiz_id, score, percentage, grade]
    );

    res.json({ success: true, score, percentage, grade });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};