const pool = require("../db");

// ================= GET STUDENT PROFILE =================
const getStudentProfile = async (req, res) => {
  try {
    const studentId = Number(req.query.id);

    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Student ID is required",
      });
    }

    const query = `
      SELECT 
        id,
        code,
        name,
        class,
        mobile,
        address,
        role,
        father_name,
        mother_name,
        profile_photo
      FROM students
      WHERE id = $1
    `;

    const { rows } = await pool.query(query, [studentId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      student: rows[0],
    });

  } catch (error) {
    console.error("Error fetching student profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// ================= INSERT STUDENT =================
const insertStudent = async (req, res) => {
  try {
    const {
      code,
      name,
      class: studentClass,
      mobile,
      address,
      role,
      father_name,
      mother_name,
      gender,
      dob,
      email,
      aadhaar,
      blood_group,
      category,
      city,
      state,
      pincode,
    } = req.body;

    if (!code || !name || !studentClass || !mobile) {
      return res.status(400).json({
        success: false,
        message: "Code, Name, Class and Mobile are required",
      });
    }

    const query = `
      INSERT INTO students (
        code, name, class, mobile, address, role,
        father_name, mother_name, gender, dob,
        email, aadhaar, blood_group, category,
        city, state, pincode
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,
        $11,$12,$13,$14,
        $15,$16,$17
      )
      RETURNING *
    `;

    const values = [
      code,
      name,
      studentClass,
      mobile,
      address || null,
      role || "student",
      father_name || null,
      mother_name || null,
      gender || null,
      dob || null,
      email || null,
      aadhaar || null,
      blood_group || null,
      category || null,
      city || null,
      state || null,
      pincode || null,
    ];

    const { rows } = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: "Student inserted successfully",
      student: rows[0],
    });

  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Student code already exists",
      });
    }

    console.error("Insert student error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// ✅ SINGLE EXPORT
module.exports = {
  getStudentProfile,
  insertStudent,
};
