const getStudentProfile = async (req, res) => {
  try {
    console.log("Received ID:", req.query.id); // ✅ check what arrives
    const studentId = Number(req.query.id);

    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ success: false, message: "Invalid student ID" });
    }

    const result = await pool.query(
      `SELECT id, name, class, mobile, address, role, profile_photo 
       FROM "Students" 
       WHERE id = $1`,
      [studentId]
    );

    console.log("DB Result:", result.rows); // ✅ check DB output

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.status(200).json({ success: true, student: result.rows[0] });
  } catch (error) {
    console.error("Error fetching profile:", error); // ✅ full error
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
