const pool = require("../db");

// 1. Fetch Assigned Subjects (Jab bacha form page khole)
const getMyExamDetails = async (req, res) => {
  try {
    const { student_id, exam_type } = req.query;

    const query = `
      SELECT subjects, status 
      FROM exam_registrations 
      WHERE student_id = $1 AND exam_type = $2
    `;
    const { rows } = await pool.query(query, [student_id, exam_type]);

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "No exam assigned for this type. Contact Admin." 
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 2. Finalize/Submit Exam Form (Status update karna)
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
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    res.json({ success: true, message: "Exam Form Submitted Successfully!", data: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = { getMyExamDetails, finalizeExamSubmission };