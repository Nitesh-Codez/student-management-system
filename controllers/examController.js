const pool = require("../db");

// 1. Fetch Exam Details (Used by ExamForm AND Admit Card)
const getMyExamDetails = async (req, res) => {
  try {
    const { student_id, exam_type } = req.query;

    const query = `
      SELECT subjects, status, student_name, student_class 
      FROM exam_registrations 
      WHERE student_id = $1 AND exam_type = $2
    `;
    const { rows } = await pool.query(query, [student_id, exam_type]);

    if (rows.length === 0) {
      // Admit card code is message ko pakad kar "Restricted" dikhayega
      return res.status(404).json({ 
        success: false, 
        message: "Exam form not found for this student." 
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Fetch Exam Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 2. Finalize/Submit (Jab bacha "Confirm" dabata hai)
const finalizeExamSubmission = async (req, res) => {
  try {
    const { student_id, exam_type } = req.body;

    const query = `
      UPDATE exam_registrations 
      SET status = 'Submitted', applied_at = NOW() 
      WHERE student_id = $1 AND exam_type = $2
      RETURNING *
    `;
    const { rows } = await pool.query(query, [student_id, exam_type]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "No registration record found to update." });
    }

    res.json({ success: true, message: "Exam Form Submitted Successfully!", data: rows[0] });
  } catch (error) {
    console.error("Submit Exam Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = { getMyExamDetails, finalizeExamSubmission };