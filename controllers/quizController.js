const db = require("../db");

/**
 * QUIZ CONTROLLER - FINAL VERSION
 * Features:
 * ✔ Class + Session + Stream Filtering
 * ✔ Strict One Attempt
 * ✔ Admin Reports (Advanced Filter)
 * ✔ Real-time grading
 */

// =======================================================
// 1. CREATE QUIZ (Admin)
// =======================================================
exports.createQuiz = async (req, res) => {
  try {
    const {
      class_name,
      subject,
      title,
      timer_minutes,
      questions,
      session,
      stream
    } = req.body;

    const total_marks = questions.length;

    const sql = `
      INSERT INTO quizzes 
      (class_name, subject, title, timer_minutes, questions, total_marks, session, stream)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;

    const result = await db.query(sql, [
      class_name,
      subject,
      title,
      timer_minutes,
      JSON.stringify(questions),
      total_marks,
      session,
      stream
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });

  } catch (err) {
    console.error("Create Quiz Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// 2. GET QUIZ LIST (CLASS + SESSION + STREAM FILTER)
// =======================================================
exports.getQuizByFilter = async (req, res) => {
  try {
    const { class_name, session, stream } = req.query;

    let sql = `
      SELECT id, title, subject, timer_minutes, total_marks, created_at
      FROM quizzes
      WHERE 1=1
    `;

    const values = [];
    let index = 1;

    if (class_name) {
      sql += ` AND class_name = $${index++}`;
      values.push(class_name);
    }

    if (session) {
      sql += ` AND session = $${index++}`;
      values.push(session);
    }

    if (stream) {
      sql += ` AND stream = $${index++}`;
      values.push(stream);
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await db.query(sql, values);

    res.json(result.rows);

  } catch (err) {
    console.error("Filter Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// 3. GET SINGLE QUIZ
// =======================================================
exports.getSingleQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM quizzes WHERE id=$1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// 4. CHECK ATTEMPT STATUS
// =======================================================
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

// =======================================================
// 5. SUBMIT QUIZ
// =======================================================
exports.submitQuiz = async (req, res) => {
  try {
    const { student_id, quiz_id, answers } = req.body;

    // check already attempted
    const check = await db.query(
      `SELECT id FROM quiz_results WHERE student_id=$1 AND quiz_id=$2`,
      [student_id, quiz_id]
    );

    if (check.rowCount > 0) {
      return res.status(403).json({ success: false, message: "Already submitted!" });
    }

    // get quiz
    const quizRes = await db.query(
      `SELECT questions, total_marks FROM quizzes WHERE id=$1`,
      [quiz_id]
    );

    if (quizRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    const quiz = quizRes.rows[0];

    const questions =
      typeof quiz.questions === "string"
        ? JSON.parse(quiz.questions)
        : quiz.questions;

    // calculate score
    let score = 0;

    questions.forEach((q, index) => {
      if (answers[index] && answers[index].trim() === q.correctAnswer.trim()) {
        score++;
      }
    });

    const percentage = ((score / quiz.total_marks) * 100).toFixed(2);

    let grade =
      percentage >= 90 ? "A+" :
      percentage >= 80 ? "A" :
      percentage >= 70 ? "B" :
      percentage >= 60 ? "C" : "D";

    const insertRes = await db.query(
      `INSERT INTO quiz_results
      (student_id, quiz_id, score, percentage, grade, answers)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [student_id, quiz_id, score, percentage, grade, JSON.stringify(answers)]
    );

    res.json({ success: true, data: insertRes.rows[0] });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// 6. ADMIN REPORT (FULL FILTER)
// =======================================================
exports.getAdminResults = async (req, res) => {
  try {
    const { class_name, session, stream } = req.query;

    let sql = `
      SELECT 
        qr.id as result_id,
        s.name as student_name,
        q.title as quiz_title,
        q.subject,
        q.class_name,
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
      WHERE 1=1
    `;

    const values = [];
    let index = 1;

    if (class_name) {
      sql += ` AND q.class_name = $${index++}`;
      values.push(class_name);
    }

    if (session) {
      sql += ` AND q.session = $${index++}`;
      values.push(session);
    }

    if (stream) {
      sql += ` AND q.stream = $${index++}`;
      values.push(stream);
    }

    sql += ` ORDER BY qr.attempted_at DESC`;

    const result = await db.query(sql, values);

    res.json(result.rows);

  } catch (err) {
    console.error("Admin Report Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// 7. DELETE QUIZ
// =======================================================
exports.deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    await db.query(`DELETE FROM quiz_results WHERE quiz_id=$1`, [quizId]);
    await db.query(`DELETE FROM quizzes WHERE id=$1`, [quizId]);

    res.json({ success: true, message: "Quiz deleted successfully" });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};