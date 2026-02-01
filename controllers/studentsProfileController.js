const pool = require("../db");

// ================= GET STUDENT PROFILE =================
// URL: /api/students/profile?id=1

const getStudentProfile = async (req, res) => {
  try {
    const studentId = Number(req.query.id); // safer than parseInt

    // ❌ ID missing or invalid
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Student ID is required",
      });
    }

    // ✅ PostgreSQL table name is lowercase: students
    const query = `
      SELECT 
        id,
        name,
        class,
        mobile,
        address,
        role,
        profile_photo
      FROM students
      WHERE id = $1
    `;

    const { rows } = await pool.query(query, [studentId]);

    // ❌ No student found
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // ✅ Success
    return res.status(200).json({
      success: true,
      student: rows[0],
    });

  } catch (error) {
    console.error("Error fetching student profile:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = { getStudentProfile };
