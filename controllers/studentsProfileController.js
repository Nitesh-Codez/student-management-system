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
    gender,
    dob,
    email,
    blood_group,
    category,
    city,
    state,
    pincode,
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

// ================= UPDATE STUDENT PROFILE =================
const updateStudentProfile = async (req, res) => {
  try {
    const studentId = Number(req.params.id);

    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Student ID required",
      });
    }

    const {
      name,
      class: studentClass,
      mobile,
      address,
      father_name,
      mother_name,
      gender,
      dob,
      email,
      blood_group,
      category,
      city,
      state,
      pincode,
    } = req.body;

    const query = `
      UPDATE students SET
        name = $1,
        class = $2,
        mobile = $3,
        address = $4,
        father_name = $5,
        mother_name = $6,
        gender = $7,
        dob = $8,
        email = $9,
        blood_group = $10,
        category = $11,
        city = $12,
        state = $13,
        pincode = $14
      WHERE id = $15
      RETURNING *
    `;

    const values = [
      name,
      studentClass,
      mobile,
      address,
      father_name,
      mother_name,
      gender,
      dob,
      email,
      blood_group,
      category,
      city,
      state,
      pincode,
      studentId,
    ];

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      student: rows[0],
    });

  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ================= REQUEST PROFILE EDIT =================
const requestProfileEdit = async (req, res) => {
  try {
    const {
      student_id,
      field_name,
      requested_value,
      reason,
    } = req.body;

    if (!student_id || !field_name || !reason) {
      return res.status(400).json({
        success: false,
        message: "Student, field and reason are required",
      });
    }

    // get old value
    const oldQuery = `SELECT ${field_name} FROM students WHERE id = $1`;
    const oldRes = await pool.query(oldQuery, [student_id]);

    if (oldRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const old_value = oldRes.rows[0][field_name];

    const query = `
      INSERT INTO profile_edit_requests
      (student_id, field_name, old_value, requested_value, reason)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `;

    const values = [
      student_id,
      field_name,
      old_value || null,
      requested_value || null,
      reason,
    ];

    const { rows } = await pool.query(query, values);

    res.json({
      success: true,
      message: "Edit request sent to admin",
      request: rows[0],
    });

  } catch (error) {
    console.error("Edit request error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ================= ADMIN ACTION =================
const handleEditRequest = async (req, res) => {
  try {
    const { request_id, status, admin_id } = req.body;

    if (!request_id || !status) {
      return res.status(400).json({
        success: false,
        message: "Request id and status required",
      });
    }

    const query = `
      UPDATE profile_edit_requests
      SET status = $1,
          action_by = $2,
          action_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      status,
      admin_id || null,
      request_id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    res.json({
      success: true,
      message: `Request ${status}`,
      data: rows[0],
    });

  } catch (error) {
    console.error("Admin edit action error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ✅ SINGLE EXPORT
module.exports = {
  getStudentProfile,
  insertStudent,
  updateStudentProfile,
  requestProfileEdit,
  handleEditRequest,
};
