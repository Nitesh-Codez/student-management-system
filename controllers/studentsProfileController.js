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
const pool = require("../db");

// ================= INSERT STUDENT =================
const pool = require("../db");

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

    // Validation
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

    return res.status(201).json({
      success: true,
      message: "Student inserted successfully",
      student: rows[0],
    });

  } catch (error) {
    // unique code error
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Student code already exists",
      });
    }

    console.error("Insert student error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = { insertStudent };
