const db = require("../db");

/**
 * QUIZ CONTROLLER - FULL VERSION (Session & Stream Integrated)
 */

// 1. CREATE QUIZ (Admin)
exports.createQuiz = async (req, res) => {
  try {
    const { class_name, subject, session, stream, title, timer_minutes, questions } = req.body;
    
    // Total marks is the number of questions
    const total_marks = questions.length;

    const sql = `
      INSERT INTO quizzes 
      (class_name, subject, session, stream, title, timer_minutes, questions, total_marks)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;

    // Stream will be saved as null for classes <= 10 if not provided
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

// 2. GET QUIZ LIST (Student Dashboard)
// Logic: If class <= 10, ignore stream. If 11 or 12, filter by stream.
exports.getQuizByClass = async (req, res) => {
  try {
    const { class_name } = req.params;
    const { session, stream, subject } = req.query; 

    // Base Query: Hamesha Class aur Session match hona chahiye
    let query = `SELECT id, title, subject, session, stream, timer_minutes, total_marks, created_at 
                 FROM quizzes WHERE class_name=$1 AND session=$2`;
    let params = [class_name, session];

    // Filter Logic for Stream (Only for 11th and 12th)
    const classNum = parseInt(class_name);
    if (classNum >= 11) {
      query += ` AND stream=$3`;
      params.push(stream);
    }

    // Filter Logic for Subject (Optional filter)
    if (subject) {
      const nextIdx = params.length + 1;
      query += ` AND subject=$${nextIdx}`;
      params.push(subject);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Get Quiz List Error:", err);
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

    // 1. Check if already attempted
    const check = await db.query(
      `SELECT id FROM quiz_results WHERE student_id=$1 AND quiz_id=$2`,
      [student_id, quiz_id]
    );

    if (check.rowCount > 0) {
      return res.status(403).json({ success: false, message: "Already submitted!" });
    }

    // 2. Fetch Quiz Questions
    const quizRes = await db.query(
      `SELECT questions, total_marks FROM quizzes WHERE id=$1`,
      [quiz_id]
    );

    if (quizRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    const quiz = quizRes.rows[0];
    const questions = typeof quiz.questions === "string" ? JSON.parse(quiz.questions) : quiz.questions;

    // 3. Calculate Score
    let score = 0;
    questions.forEach((q, index) => {
      if (answers[index] && answers[index].trim() === q.correctAnswer.trim()) {
        score++;
      }
    });

    const percentage = ((score / quiz.total_marks) * 100).toFixed(2);
    let grade = percentage >= 90 ? "A+" : percentage >= 80 ? "A" : percentage >= 70 ? "B" : percentage >= 60 ? "C" : "D";

    // 4. Insert Result
    const insertRes = await db.query(
      `INSERT INTO quiz_results
      (student_id, quiz_id, score, percentage, grade, answers)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [student_id, quiz_id, score, percentage, grade, JSON.stringify(answers)]
    );

    res.json({ success: true, data: insertRes.rows[0] });

  } catch (err) {
    console.error("Submit Quiz Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. ADMIN REPORT (With Name Join and Filter by Session/Stream)
exports.getAdminResults = async (req, res) => {
    try {
        const { class_name } = req.params;
        const { session, stream } = req.query;
        
        let sql = `
            SELECT 
                qr.id as result_id,
                s.name as student_name,
                q.title as quiz_title,
                q.subject,
                q.session,
                q.stream,
                qr.score,
                q.total_marks,
                qr.percentage,
                qr.grade,
                qr.attempted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as created_at
            FROM quiz_results qr
            JOIN students s ON qr.student_id = s.id
            JOIN quizzes q ON qr.quiz_id = q.id
            WHERE q.class_name = $1
        `;

        let params = [class_name];

        if (session) {
          sql += ` AND q.session = $2`;
          params.push(session);
        }
        
        if (stream && parseInt(class_name) >= 11) {
          const streamIdx = params.length + 1;
          sql += ` AND q.stream = $${streamIdx}`;
          params.push(stream);
        }

        sql += ` ORDER BY qr.attempted_at DESC`;

        const result = await db.query(sql, params);
        res.json(result.rows); 
    } catch (err) {
        console.error("Admin Report Error:", err);
        res.status(500).json({ success: false, message: "Database error" });
    }
};

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