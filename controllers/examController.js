const pool = require("../db");

// 1. Fetch Exam Details (Used by ExamForm AND Admit Card)
const getMyExamDetails = async (req, res) => {
  try {
    const { student_id, exam_type } = req.query;

    if (!student_id || !exam_type) {
      return res.status(400).json({
        success: false,
        message: "student_id and exam_type are required."
      });
    }

    const query = `
      SELECT
        student_id,
        student_name,
        student_class,
        exam_type,
        session_year,
        subjects,
        status,
        applied_at
      FROM exam_registrations
      WHERE student_id = $1
      AND exam_type = $2
      LIMIT 1
    `;

    const { rows } = await pool.query(query, [student_id, exam_type]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Exam form not found for this student."
      });
    }

    return res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error("Fetch Exam Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

// 2. Finalize Exam Submission
const finalizeExamSubmission = async (req, res) => {
  try {
    const { student_id, student_name, student_class, session_year, exam_type, subjects } = req.body;

    if (!student_id || !exam_type) {
      return res.status(400).json({
        success: false,
        message: "student_id and exam_type are required."
      });
    }

    const currentSession = session_year || "2026-2027";

    const query = `
      INSERT INTO exam_registrations (student_id, student_name, student_class, session_year, exam_type, subjects, status, applied_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'Submitted', NOW())
      ON CONFLICT (student_id, exam_type, session_year) 
      DO UPDATE SET 
        status = 'Submitted',
        subjects = EXCLUDED.subjects,
        applied_at = NOW()
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      student_id, 
      student_name || 'N/A', 
      student_class || 'N/A', 
      currentSession, 
      exam_type, 
      subjects
    ]);

    return res.json({
      success: true,
      message: "Exam Form Submitted Successfully!",
      data: rows[0]
    });

  } catch (error) {
    console.error("Submit Exam Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};
// 3. Get My Subjects
const getMySubjects = async (req, res) => {
  try {
    const { student_id, exam_type } = req.query;

    if (!student_id || !exam_type) {
      return res.status(400).json({
        success: false,
        message: "student_id and exam_type are required."
      });
    }

    const query = `
      SELECT
        student_name,
        student_class,
        exam_type,
        subjects
      FROM exam_registrations
      WHERE student_id = $1
      AND exam_type = $2
      LIMIT 1
    `;

    const { rows } = await pool.query(query, [student_id, exam_type]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Subjects not found."
      });
    }

    let subjects = rows[0].subjects;

    // Agar PostgreSQL array hai to as it is
    // Agar comma separated string hai to array bana do
    if (typeof subjects === "string") {
      subjects = subjects
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return res.json({
      success: true,
      student_name: rows[0].student_name,
      student_class: rows[0].student_class,
      exam_type: rows[0].exam_type,
      subjects
    });

  } catch (error) {
    console.error("Get Subjects Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};


//==============================================================
// 4. Get All Submitted Exam Forms (Admin)
//===============================================================
const getTotalExamSubmissions = async (req, res) => {
  try {
    const query = `
      SELECT
        id,
        student_id,
        student_name,
        student_class,
        exam_type,
        subjects,
        session_year,
        status,
        applied_at
      FROM exam_registrations
      WHERE status = 'Submitted'
      ORDER BY applied_at DESC;
    `;

    const { rows } = await pool.query(query);

    // Agar subjects string hai to array bana do
    const students = rows.map((student) => ({
      ...student,
      subjects:
        typeof student.subjects === "string"
          ? student.subjects
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : student.subjects,
    }));

    return res.json({
      success: true,
      total_submissions: students.length,
      students,
    });

  } catch (error) {
    console.error("Get Submitted Exam Forms Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};


// ======================================================
// Get Submitted Students For Internal Marks
// ======================================================
const getSubmittedStudentsForMarks = async (req, res) => {
  try {
    const query = `
      SELECT
        e.id AS registration_id,
        e.student_id,
        e.student_name,
        e.student_class,
        e.exam_type,
        e.subjects,
        e.session_year,
        e.status,
        e.applied_at,
        COALESCE(m.task_marks, 0) AS task_marks,
        COALESCE(m.behavior_marks, 0) AS behavior_marks,
        COALESCE(m.performance_marks, 0) AS performance_marks
      FROM exam_registrations e
      LEFT JOIN internal_marks m
        ON m.student_id = e.student_id
       AND m.exam_type = e.exam_type
       AND m.session_year = e.session_year
      WHERE e.status = 'Submitted'
      ORDER BY e.student_class, e.student_name;
    `;

    const { rows } = await pool.query(query);

    return res.status(200).json({
      success: true,
      total_students: rows.length,
      data: rows,
    });

  } catch (error) {
    console.error("Error fetching submitted students:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
// Save the evaluation marks
const saveInternalMarks = async (req, res) => {
    const { marksData } = req.body; // Array containing student_id, exam_type, session_year, and marks
    
    try {
        for (const item of marksData) {
            const upsertQuery = `
                INSERT INTO internal_marks (student_id, exam_type, session_year, task_marks, behavior_marks, performance_marks, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (student_id, exam_type, session_year) 
                DO UPDATE SET 
                    task_marks = EXCLUDED.task_marks,
                    behavior_marks = EXCLUDED.behavior_marks,
                    performance_marks = EXCLUDED.performance_marks,
                    updated_at = NOW();
            `;
            await pool.query(upsertQuery, [
                item.student_id,
                item.exam_type,
                item.session_year || '2025-26',
                item.task_marks || 0,
                item.behavior_marks || 0,
                item.performance_marks || 0
            ]);
        }
        res.status(200).json({ success: true, message: 'Marks saved successfully!' });
    } catch (error) {
        console.error('Error saving marks:', error);
        res.status(500).json({ success: false, message: 'Failed to save marks' });
    }
};

/////

// const pool = require('../config/db'); // Apna DB pool yahan import karein


module.exports = {
  getMyExamDetails,
  finalizeExamSubmission,
  getMySubjects,
  getTotalExamSubmissions,
  saveInternalMarks,
  getSubmittedStudentsForMarks,
  
};