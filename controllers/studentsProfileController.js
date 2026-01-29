const pool = require("../db");

// Get student profile by ID (query param)
const getStudentProfile = async (req, res) => {
  try {
    const studentId = req.query.id; // frontend se /profile?id=27 pass hoga

    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID required" });
    }

    const result = await pool.query(
      `SELECT id, name, class, mobile, address, role, profile_photo 
       FROM Students 
       WHERE id = $1`,
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.status(200).json({ success: true, student: result.rows[0] });
  } catch (error) {
    console.error("Error fetching profile:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = { getStudentProfile };
