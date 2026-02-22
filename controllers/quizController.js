const db = require("../db");

/**
 * QUIZ CONTROLLER - IMPROVED VERSION
 * Features: Strict One-Attempt, Admin Reports with Joins, Real-time Grading
 */

// 1. CREATE QUIZ (Admin)
exports.createQuiz = async (req, res) => {
  try {
    const { class_name, subject, title, timer_minutes, questions } = req.body;
    // Total marks is the number of questions
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

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Create Quiz Error:", err);
    res.status(500).json({ success: false, message: "Server error while creating quiz" });
  }
};

// 2. GET QUIZ LIST (Student Dashboard)
exports.getQuizByClass = async (req, res) => {
  try {
    const { class_name } = req.params;
    // We only fetch basic info, not the questions to prevent cheating before start
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

// 3. GET SINGLE QUIZ (For Attempt Page)
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

// 4. CHECK ATTEMPT STATUS (Guard for Frontend)
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

// 5. SUBMIT QUIZ (Strict 1-Attempt Logic & Real-time Calc)
exports.submitQuiz = async (req, res) => {
  try {
    const { student_id, quiz_id, answers } = req.body;

    // STEP A: Lock - Check if already exists in quiz_results
    const check = await db.query(
        `SELECT id FROM quiz_results WHERE student_id=$1 AND quiz_id=$2`, 
        [student_id, quiz_id]
    );
    
    if (check.rowCount > 0) {
      return res.status(403).json({ 
        success: false, 
        message: "STRICT LOCK: You have already submitted this quiz once." 
      });
    }

    // STEP B: Fetch Quiz Correct Answers
    const quizRes = await db.query(`SELECT questions, total_marks FROM quizzes WHERE id=$1`, [quiz_id]);
    if (quizRes.rowCount === 0) return res.status(404).json({ success: false, message: "Quiz data lost" });

    const quiz = quizRes.rows[0];
    const questions = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions;

    // STEP C: Score Calculation
    let score = 0;
    questions.forEach((q, index) => {
      // Comparison logic (Ensure cases match)
      if (answers[index] && answers[index].trim() === q.correctAnswer.trim()) {
        score++;
      }
    });

    const percentage = ((score / quiz.total_marks) * 100).toFixed(2);
    
    // STEP D: Dynamic Grading System
    let grade = "F";
    if (percentage >= 90) grade = "A+";
    else if (percentage >= 80) grade = "A";
    else if (percentage >= 70) grade = "B";
    else if (percentage >= 60) grade = "C";
    else if (percentage >= 40) grade = "D";

    // STEP E: Final Save
    const insertRes = await db.query(
      `INSERT INTO quiz_results (student_id, quiz_id, score, percentage, grade)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [student_id, quiz_id, score, percentage, grade]
    );

    res.json({ 
        success: true, 
        message: "Quiz submitted successfully",
        data: insertRes.rows[0] 
    });
  } catch (err) {
    console.error("Submission Error:", err);
    res.status(500).json({ success: false, message: "System failure during submission" });
  }
};

// 6. ADMIN REPORT (Fetch all student results with names & timestamp)
exports.getAdminResults = async (req, res) => {
    try {
      const { class_name } = req.params;
      
      // SQL JOIN to get student name from 'students' table and quiz details from 'quizzes'
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
          qr.attempted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as submission_time
        FROM quiz_results qr
        JOIN students s ON qr.student_id = s.id
        JOIN quizzes q ON qr.quiz_id = q.id
        WHERE q.class_name = $1
        ORDER BY qr.attempted_at DESC
      `;
  
      const result = await db.query(sql, [class_name]);
      
      if(result.rowCount === 0) {
          return res.json({ success: true, message: "No records found for this class", data: [] });
      }

      res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error("Admin Report Error:", err);
      res.status(500).json({ success: false, message: "Database error" });
    }
};