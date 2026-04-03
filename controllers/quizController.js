const db = require("../db");

/**
 * QUIZ CONTROLLER - SMARTZONE (Session & Stream Integrated)
 */

// 1. CREATE QUIZ (Admin)
exports.createQuiz = async (req, res) => {
  try {
    const { class_name, subject, session, stream, title, timer_minutes, questions } = req.body;
    const total_marks = questions.length;

    const sql = `
      INSERT INTO quizzes 
      (class_name, subject, session, stream, title, timer_minutes, questions, total_marks)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;

    const result = await db.query(sql, [
      class_name,
      subject,
      session,
      stream || null,
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

// 5. SUBMIT QUIZ (The Core Logic Fix)
exports.submitQuiz = async (req, res) => {
  try {
    const { student_id, quiz_id, answers } = req.body;

    const sId = parseInt(student_id);
    const qId = parseInt(quiz_id);

    // 1. Validation
    if (isNaN(sId) || isNaN(qId) || !answers) {
      return res.status(400).json({ success: false, message: "Missing student info or answers" });
    }

    // 2. Already Attempted Check
    const check = await db.query(
      `SELECT id FROM quiz_results WHERE student_id=$1 AND quiz_id=$2`,
      [sId, qId]
    );
    if (check.rowCount > 0) {
      return res.status(403).json({ success: false, message: "Already submitted!" });
    }

    // 3. Get Quiz Data
    const quizRes = await db.query(`SELECT questions, total_marks FROM quizzes WHERE id=$1`, [qId]);
    if (quizRes.rowCount === 0) return res.status(404).json({ success: false, message: "Quiz not found" });

    const quiz = quizRes.rows[0];
    let questions = typeof quiz.questions === "string" ? JSON.parse(quiz.questions) : quiz.questions;

    // 4. SCORE CALCULATION (Robust Version)
    let score = 0;
    questions.forEach((q, index) => {
      const studentAns = answers[index] ? answers[index].toString().trim().toLowerCase() : "";
      const correctAns = q.correctAnswer ? q.correctAnswer.toString().trim().toLowerCase() : "";

      // Debugging ke liye (Sirf development mein use karein)
      // console.log(`Q${index}: Student: ${studentAns} | Correct: ${correctAns}`);

      if (studentAns !== "" && studentAns === correctAns) {
        score++;
      }
    });

    // 5. PERCENTAGE & GRADE (Decimal safe logic)
    const totalMarks = parseInt(quiz.total_marks) || questions.length || 1; 
    const percentage = parseFloat(((score / totalMarks) * 100).toFixed(2));
    
    let grade = "F";
    if (percentage >= 90) grade = "A+";
    else if (percentage >= 80) grade = "A";
    else if (percentage >= 70) grade = "B";
    else if (percentage >= 60) grade = "C";
    else if (percentage >= 33) grade = "D";

    // 6. Final DB Entry
    const insertRes = await db.query(
      `INSERT INTO quiz_results 
      (student_id, quiz_id, score, percentage, grade, answers) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [sId, qId, score, percentage, grade, JSON.stringify(answers)]
    );

    res.json({ success: true, data: insertRes.rows[0] });

  } catch (err) {
    console.error("Submit Quiz Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. ADMIN REPORT
exports.getAdminResults = async (req, res) => {
  try {
    const { class_name } = req.params;
    const { session, stream } = req.query;

    let sql = `
      SELECT 
        qr.id as result_id, s.name as student_name, q.title as quiz_title, 
        q.subject, q.session, q.stream, qr.score, q.total_marks, 
        qr.percentage, qr.grade,
        qr.attempted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as created_at
      FROM quiz_results qr
      JOIN students s ON qr.student_id = s.id
      JOIN quizzes q ON qr.quiz_id = q.id
      WHERE q.class_name = $1
    `;

    let params = [class_name];

    if (session) {
      params.push(session);
      sql += ` AND q.session = $${params.length}`;
    }
    
    if (stream && parseInt(class_name) >= 11) {
      params.push(stream);
      sql += ` AND q.stream = $${params.length}`;
    }

    sql += ` ORDER BY qr.attempted_at DESC`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error" });
  }
};

// Include other exports (getQuizByClass, deleteQuiz, etc.) as they were...
// 7. GET QUIZ REVIEW
exports.getQuizReview = async (req, res) => {
  try {
    const { quizId, studentId } = req.params;

    const quizRes = await db.query(`SELECT * FROM quizzes WHERE id=$1`, [quizId]);
    if (quizRes.rowCount === 0) return res.status(404).json({ success: false, message: "Quiz not found" });

    const quiz = quizRes.rows[0];

    const resultRes = await db.query(
      `SELECT *, attempted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as finish_time
       FROM quiz_results WHERE quiz_id=$1 AND student_id=$2`,
      [quizId, studentId]
    );

    if (resultRes.rowCount === 0) return res.status(404).json({ success: false, message: "Result not found" });

    const studentResult = resultRes.rows[0];

    res.json({
      success: true,
      data: {
        quiz_info: { title: quiz.title, subject: quiz.subject, total_marks: quiz.total_marks },
        questions: typeof quiz.questions === "string" ? JSON.parse(quiz.questions) : quiz.questions,
        student_answers: studentResult.answers,
        student_result: studentResult,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 8. UPDATE QUESTION (Admin Only)
exports.updateQuestion = async (req, res) => {
  try {
    const { quizId, questionIndex } = req.params;
    const { question, options, correctAnswer } = req.body;

    const quizRes = await db.query(`SELECT questions FROM quizzes WHERE id=$1`, [quizId]);
    if (quizRes.rowCount === 0) return res.status(404).json({ success: false, message: "Quiz not found" });

    let questions = typeof quizRes.rows[0].questions === "string" ? JSON.parse(quizRes.rows[0].questions) : quizRes.rows[0].questions;

    if (!questions[questionIndex]) return res.status(404).json({ success: false, message: "Question index invalid" });

    if (question) questions[questionIndex].question = question;
    if (options) questions[questionIndex].options = options;
    if (correctAnswer) questions[questionIndex].correctAnswer = correctAnswer;

    const updateRes = await db.query(
      `UPDATE quizzes SET questions=$1 WHERE id=$2 RETURNING *`,
      [JSON.stringify(questions), quizId]
    );

    res.json({ success: true, data: updateRes.rows[0] });
  } catch (err) {
    console.error("Update Question Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 9. DELETE QUIZ
exports.deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    await db.query(`DELETE FROM quiz_results WHERE quiz_id=$1`, [quizId]);
    await db.query(`DELETE FROM quizzes WHERE id=$1`, [quizId]);
    res.json({ success: true, message: "Quiz deleted successfully" });
  } catch (err) {
    console.error("Delete Quiz Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};