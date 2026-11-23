
const db = require("../db");

/**
 * QUIZ CONTROLLER - FULL VERSION
 * Session + Stream + Start/End Time + Attempted At
 */

// 1. CREATE QUIZ (ADMIN)
exports.createQuiz = async (req, res) => {
  try {
    const {
      class_name,
      subject,
      session,
      stream,
      title,
      timer_minutes,
      start_at,
      end_at,
      questions
    } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        message: "Questions are required"
      });
    }

    const total_marks = questions.length;

    const sql = `
      INSERT INTO quizzes
      (
        class_name,
        subject,
        session,
        stream,
        title,
        timer_minutes,
        start_at,
        end_at,
        questions,
        total_marks
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `;

    const result = await db.query(sql, [
      class_name,
      subject,
      session,
      stream || null,
      title,
      timer_minutes,
      start_at || null,
      end_at || null,
      JSON.stringify(questions),
      total_marks
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Create Quiz Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while creating quiz"
    });
  }
};


// 2. GET QUIZ LIST (STUDENT + ADMIN)
exports.getQuizByClass = async (req, res) => {
  try {
    const { class_name } = req.params;
    const { session, stream, subject } = req.query;

    let query = `
      SELECT
        id,
        title,
        subject,
        session,
        stream,
        timer_minutes,
        start_at,
        end_at,
        questions,
        total_marks,
        created_at
      FROM quizzes
      WHERE class_name=$1 AND session=$2
    `;

    let params = [class_name, session];

    const classNum = parseInt(class_name);

    if (classNum >= 11 && stream) {
      query += ` AND stream=$3`;
      params.push(stream);
    }

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
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};


// 3. GET SINGLE QUIZ (STUDENT)
exports.getSingleQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM quizzes WHERE id=$1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};


// 4. CHECK ATTEMPT STATUS
exports.checkAttemptStatus = async (req, res) => {
  try {
    const { quizId, studentId } = req.params;

    const check = await db.query(
      `SELECT 
          qr.*,
          q.title AS quiz_title
       FROM quiz_results qr
       INNER JOIN quizzes q 
          ON qr.quiz_id = q.id
       WHERE qr.quiz_id = $1 
       AND qr.student_id = $2`,
      [quizId, studentId]
    );

    if (check.rowCount > 0) {
      return res.json({
        attempted: true,
        result: check.rows[0],
        attempted_at: check.rows[0].attempted_at,
        quiz_title: check.rows[0].quiz_title
      });
    }

    res.json({
      attempted: false,
      attempted_at: null
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
// 5. SUBMIT QUIZ (STUDENT)
exports.submitQuiz = async (req, res) => {
  try {
    const {
      student_id,
      quiz_id,
      answers,
      stream,
      session
    } = req.body;

    const sId = parseInt(student_id);
    const qId = parseInt(quiz_id);

    if (isNaN(sId) || isNaN(qId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Student or Quiz ID"
      });
    }

    // Prevent multiple attempts
    const check = await db.query(
      `SELECT id FROM quiz_results
       WHERE student_id=$1 AND quiz_id=$2`,
      [sId, qId]
    );

    if (check.rowCount > 0) {
      return res.status(403).json({
        success: false,
        message: "Already submitted!"
      });
    }

    // Get quiz
    const quizRes = await db.query(
      `SELECT questions, total_marks, start_at, end_at
       FROM quizzes
       WHERE id=$1`,
      [qId]
    );

    if (quizRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }

    let questions = quizRes.rows[0].questions;

    if (typeof questions === "string") {
      questions = JSON.parse(questions);
    }

    // Normalize answers
    const normalize = (val) => {
      if (val === null || val === undefined) return "";

      return String(val)
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/,/g, ",")
        .trim();
    };

    // Calculate score
    let score = 0;

    questions.forEach((q, index) => {
      const studentAns = answers[index];
      const correctAns = q.correctAnswer || q.answer;

      if (
        studentAns === undefined ||
        correctAns === undefined
      ) {
        return;
      }

      const sAns = normalize(studentAns);
      const cAns = normalize(correctAns);

      const sortAns = (val) =>
        val
          .split(",")
          .map((v) => v.trim())
          .sort()
          .join(",");

      if (sortAns(sAns) === sortAns(cAns)) {
        score++;
      }
    });

    // Total marks
    const totalMarks =
      quizRes.rows[0].total_marks || questions.length;

    const percentage = parseFloat(
      totalMarks > 0
        ? ((score / totalMarks) * 100).toFixed(2)
        : 0
    );

    // Grade logic
    let grade = "F";

    if (percentage >= 90) grade = "A+";
    else if (percentage >= 80) grade = "A";
    else if (percentage >= 70) grade = "B";
    else if (percentage >= 60) grade = "C";
    else if (percentage >= 33) grade = "D";

    // Save result + submission timestamp
    const insertRes = await db.query(
      `INSERT INTO quiz_results
      (
        student_id,
        quiz_id,
        score,
        percentage,
        grade,
        answers,
        stream,
        session,
        attempted_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      RETURNING *`,
      [
        sId,
        qId,
        score,
        percentage,
        grade,
        JSON.stringify(answers),
        stream || null,
        session || null
      ]
    );

    res.json({
      success: true,
      data: insertRes.rows[0],
      attempted_at: insertRes.rows[0].attempted_at
    });

  } catch (err) {
    console.error("Submit Quiz Error:", err);

    res.status(500).json({
      success: false,
      message: "Server Error: " + err.message
    });
  }
};


// 6. ADMIN REPORT (includes student_id & quiz_id)
exports.getAdminResults = async (req, res) => {
  try {
    const { class_name } = req.params;
    const { session, stream } = req.query;

    let sql = `
      SELECT
        qr.id AS result_id,
        qr.student_id AS student_id,
        qr.quiz_id AS quiz_id,
        s.name AS student_name,
        q.class_name,
        q.title AS quiz_title,
        q.subject,
        q.session,
        q.stream,
        q.start_at,
        q.end_at,
        qr.score,
        q.total_marks,
        qr.percentage,
        qr.grade,
        qr.attempted_at AT TIME ZONE 'Asia/Kolkata' AS attempted_at,
        qr.attempted_at AT TIME ZONE 'Asia/Kolkata' AS formatted_date
      FROM quiz_results qr
      JOIN students s ON qr.student_id = s.id
      JOIN quizzes q ON qr.quiz_id = q.id
      WHERE q.class_name=$1
    `;

    const params = [class_name];

    if (session) {
      params.push(session);
      sql += ` AND q.session=$${params.length}`;
    }

    if (stream && parseInt(class_name, 10) >= 11) {
      params.push(stream);
      sql += ` AND q.stream=$${params.length}`;
    }

    sql += ` ORDER BY qr.attempted_at DESC`;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Admin Report Error:", err);
    res.status(500).json({
      success: false,
      message: "Database Error"
    });
  }
};


// 7. GET QUIZ REVIEW (STUDENT + ADMIN)
exports.getQuizReview = async (req, res) => {
  try {
    const { quizId, studentId } = req.params;

    const quizRes = await db.query(
      `SELECT * FROM quizzes WHERE id=$1`,
      [quizId]
    );

    if (quizRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }

    const quiz = quizRes.rows[0];

    const resultRes = await db.query(
      `SELECT *,
        attempted_at AT TIME ZONE 'Asia/Kolkata'
        AS finish_time
       FROM quiz_results
       WHERE quiz_id=$1 AND student_id=$2`,
      [quizId, studentId]
    );

    if (resultRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Result not found"
      });
    }

    const studentResult = resultRes.rows[0];

    res.json({
      success: true,

      data: {
        quiz_info: {
          title: quiz.title,
          subject: quiz.subject,
          total_marks: quiz.total_marks,
          start_at: quiz.start_at,
          end_at: quiz.end_at
        },

        questions:
          typeof quiz.questions === "string"
            ? JSON.parse(quiz.questions)
            : quiz.questions,

        student_answers: studentResult.answers,

        student_result: studentResult,

        attempted_at: studentResult.attempted_at,

        finish_time: studentResult.finish_time
      }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

//===============================
// 8. UPDATE QUESTION
//===============================
exports.updateQuestion = async (req, res) => {
  try {
    const { quizId, questionIndex } = req.params;
    const { question, options, correctAnswer } = req.body;

    const quizRes = await db.query(
      `SELECT questions FROM quizzes WHERE id=$1`,
      [quizId]
    );

    if (quizRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }

    let questions =
      typeof quizRes.rows[0].questions === "string"
        ? JSON.parse(quizRes.rows[0].questions)
        : quizRes.rows[0].questions;

    if (!questions[questionIndex]) {
      return res.status(404).json({
        success: false,
        message: "Question index invalid"
      });
    }

    if (question) questions[questionIndex].question = question;
    if (options) questions[questionIndex].options = options;
    if (correctAnswer) {
      questions[questionIndex].correctAnswer = correctAnswer;
    }

    const updateRes = await db.query(
      `UPDATE quizzes
       SET questions=$1
       WHERE id=$2
       RETURNING *`,
      [JSON.stringify(questions), quizId]
    );

    res.json({
      success: true,
      data: updateRes.rows[0]
    });

  } catch (err) {
    console.error("Update Question Error:", err);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

//===================================
// 9. DELETE QUIZ
//===================================
exports.deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    await db.query(
      `DELETE FROM quiz_results WHERE quiz_id=$1`,
      [quizId]
    );

    await db.query(
      `DELETE FROM quizzes WHERE id=$1`,
      [quizId]
    );

    res.json({
      success: true,
      message: "Quiz deleted successfully"
    });

  } catch (err) {
    console.error("Delete Quiz Error:", err);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


//==========================
//EDIT quiz
//=========================
// 10. EDIT QUIZ (ADMIN)
exports.editQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    const {
      created_at,
      start_at,
      end_at,
      timer_minutes
    } = req.body;

    const result = await db.query(
      `UPDATE quizzes
       SET
         created_at = COALESCE($1, created_at),
         start_at = COALESCE($2, start_at),
         end_at = COALESCE($3, end_at),
         timer_minutes = COALESCE($4, timer_minutes)
       WHERE id = $5
       RETURNING *`,
      [
        created_at ?? null,
        start_at ?? null,
        end_at ?? null,
        timer_minutes ?? null,
        quizId
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }

    res.json({
      success: true,
      message: "Quiz updated successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Edit Quiz Error:", err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

//=====================================
//RENIEW QUIZ
//=======================================

// 11. RENEW QUIZ (ADMIN - RESET STUDENT ATTEMPT)
exports.renewQuiz = async (req, res) => {
  try {
    const { quizId, studentId } = req.params;

    // Check quiz exists
    const quiz = await db.query(
      `SELECT id, title FROM quizzes WHERE id = $1`,
      [quizId]
    );

    if (quiz.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }

    // Check student exists
    const student = await db.query(
      `SELECT id, name FROM students WHERE id = $1`,
      [studentId]
    );

    if (student.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    // Delete only selected student's result
    const deleted = await db.query(
      `DELETE FROM quiz_results
       WHERE quiz_id = $1
       AND student_id = $2
       RETURNING *`,
      [quizId, studentId]
    );

    if (deleted.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Student has not attempted this quiz yet"
      });
    }

    res.json({
      success: true,
      message: "Student quiz renewed successfully. Student can attempt again.",
      student: student.rows[0].name,
      quiz: quiz.rows[0].title,
      previous_result_deleted: true
    });

  } catch (err) {
    console.error("Renew Quiz Error:", err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};