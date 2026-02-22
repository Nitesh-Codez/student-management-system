const db = require("../db");

// ✅ 1. Create Quiz (Admin)
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

// ✅ 2. Get Quiz by Class (Student Dashboard List)
exports.getQuizByClass = async (req, res) => {
  try {
    const { class_name } = req.params;
    const result = await db.query(
      `SELECT id, title, subject, timer_minutes, total_marks, created_at 
       FROM quizzes WHERE class_name=$1 ORDER BY created_at DESC`,
      [class_name]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ 3. Get Single Quiz Details (For Attempt Page)
exports.getSingleQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`SELECT * FROM quizzes WHERE id=$1`, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ 4. Check If Already Attempted (Frontend Safety)
exports.checkAttemptStatus = async (req, res) => {
    try {
      const { quizId, studentId } = req.params;
      const check = await db.query(
        `SELECT * FROM quiz_results WHERE quiz_id=$1 AND student_id=$2`, 
        [quizId, studentId]
      );
      
      if (check.rowCount > 0) {
        return res.json({ attempted: true, result: check.rows[0] });
      }
      res.json({ attempted: false });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
};

// ✅ 5. Submit Quiz (With Strict 1-Attempt Logic)
exports.submitQuiz = async (req, res) => {
  try {
    const { student_id, quiz_id, answers } = req.body;

    // A. Check if already attempted
    const check = await db.query(
        `SELECT id FROM quiz_results WHERE student_id=$1 AND quiz_id=$2`, 
        [student_id, quiz_id]
    );
    if (check.rowCount > 0) {
      return res.status(400).json({ success: false, message: "Already attempted!" });
    }

    // B. Get Quiz Data
    const quizRes = await db.query(`SELECT * FROM quizzes WHERE id=$1`, [quiz_id]);
    if (quizRes.rowCount === 0) return res.status(404).json({ success: false, message: "Quiz not found" });

    const quiz = quizRes.rows[0];
    const questions = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions;

    // C. Calculation
    let score = 0;
    questions.forEach((q, index) => {
      if (answers[index] === q.correctAnswer) score++;
    });

    const percentage = ((score / quiz.total_marks) * 100).toFixed(2);
    
    let grade = "F";
    if (percentage >= 90) grade = "A+";
    else if (percentage >= 80) grade = "A";
    else if (percentage >= 70) grade = "B";
    else if (percentage >= 60) grade = "C";
    else if (percentage >= 40) grade = "D";

    // D. Save to DB
    const insertRes = await db.query(
      `INSERT INTO quiz_results (student_id, quiz_id, score, percentage, grade)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [student_id, quiz_id, score, percentage, grade]
    );

    res.json({ success: true, ...insertRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ 6. Get Admin Results (For Admin Panel)
exports.getAdminResults = async (req, res) => {
    try {
      const { class_name } = req.params;
      
      const sql = `
        SELECT 
          qr.id as result_id,
          s.name as student_name,
          s.id as student_id,
          q.title as quiz_title,
          q.subject,
          qr.score,
          q.total_marks,
          qr.percentage,
          qr.grade,
          qr.attempted_at as timestamp
        FROM quiz_results qr
        JOIN students s ON qr.student_id = s.id
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.class_name = $1
        ORDER BY qr.attempted_at DESC
      `;
  
      const result = await db.query(sql, [class_name]);
      res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
};