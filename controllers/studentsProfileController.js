const pool = require("../db");

// ================= GET STUDENT PROFILE =================
const getStudentProfile = async (req, res) => {
  try {
    const studentId = Number(req.query.id);
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ success: false, message: "Valid Student ID is required" });
    }

    const query = `
      SELECT 
        id, code, name, class, mobile, address, role, 
        father_name, mother_name, gender, dob, email, 
        aadhaar, blood_group, category, city, state, 
        pincode, profile_photo, district
      FROM students
      WHERE id = $1
    `;

    const { rows } = await pool.query(query, [studentId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.status(200).json({ success: true, student: rows[0] });
  } catch (error) {
    console.error("Error fetching student profile:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ================= INSERT STUDENT (Fixed District) =================
const insertStudent = async (req, res) => {
  try {
    const {
      code, name, class: studentClass, mobile, address, role,
      father_name, mother_name, gender, dob, email, aadhaar,
      blood_group, category, city, state, pincode, district,
    } = req.body;

    if (!code || !name || !studentClass || !mobile) {
      return res.status(400).json({ success: false, message: "Code, Name, Class and Mobile are required" });
    }

    // SQL query mein 'district' aur placeholder '$18' add kiya gaya hai
    const query = `
      INSERT INTO students (
        code, name, class, mobile, address, role,
        father_name, mother_name, gender, dob,
        email, aadhaar, blood_group, category,
        city, state, pincode, district
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18
      )
      RETURNING *
    `;

    const values = [
      code, name, studentClass, mobile, address || null, role || "student",
      father_name || null, mother_name || null, gender || null, dob || null,
      email || null, aadhaar || null, blood_group || null, category || null,
      city || null, state || null, pincode || null, district || null,
    ];

    const { rows } = await pool.query(query, values);

    res.status(201).json({ success: true, message: "Student inserted successfully", student: rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "Student code already exists" });
    }
    console.error("Insert student error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ================= UPDATE STUDENT PROFILE =================
// ================= UPDATE STUDENT PROFILE (Fixed with CODE) =================
const updateStudentProfile = async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ success: false, message: "Valid Student ID required" });
    }

    const {
      code,          // <--- Ye missing tha!
      name,
      class: studentClass,
      mobile,
      address,
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
      district,
    } = req.body;

    const query = `
      UPDATE students SET
        code = $1,      -- <--- Query mein add kiya
        name = $2, 
        class = $3, 
        mobile = $4, 
        address = $5,
        father_name = $6, 
        mother_name = $7, 
        gender = $8, 
        dob = $9,
        email = $10, 
        aadhaar = $11, 
        blood_group = $12, 
        category = $13,
        city = $14, 
        state = $15, 
        pincode = $16, 
        district = $17
      WHERE id = $18    -- <--- Index change ho gaya
      RETURNING *
    `;

    const values = [
      code,             // $1
      name,             // $2
      studentClass,     // $3
      mobile,           // $4
      address,          // $5
      father_name,      // $6
      mother_name,      // $7
      gender,           // $8
      dob,              // $9
      email,            // $10
      aadhaar,          // $11
      blood_group,      // $12
      category,         // $13
      city,             // $14
      state,            // $15
      pincode,          // $16
      district,         // $17
      studentId         // $18
    ];

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      student: rows[0], // Ye rows[0] ab naya 'code' lekar jayega frontend pe
    });

  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// ================= REQUEST PROFILE EDIT =================
const requestProfileEdit = async (req, res) => {
  try {
    const { student_id, field_name, requested_value, reason } = req.body;

    if (!student_id || !field_name || !reason) {
      return res.status(400).json({ success: false, message: "Student, field and reason are required" });
    }

    const oldQuery = `SELECT ${field_name} FROM students WHERE id = $1`;
    const oldRes = await pool.query(oldQuery, [student_id]);

    if (oldRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const old_value = oldRes.rows[0][field_name];

    const query = `
      INSERT INTO profile_edit_requests (student_id, field_name, old_value, requested_value, reason)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [student_id, field_name, old_value || null, requested_value || null, reason];
    const { rows } = await pool.query(query, values);

    res.json({ success: true, message: "Edit request sent to admin", request: rows[0] });
  } catch (error) {
    console.error("Edit request error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ================= ADMIN ACTION (HANDLE REQUEST) =================
const handleEditRequest = async (req, res) => {
  try {
    const { request_id, status, admin_id } = req.body;

    if (!request_id || !status) {
      return res.status(400).json({ success: false, message: "Request id and status required" });
    }

    const query = `
      UPDATE profile_edit_requests
      SET status = $1, action_by = $2, action_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const { rows } = await pool.query(query, [status, admin_id || null, request_id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    res.json({ success: true, message: `Request ${status}`, data: rows[0] });
  } catch (error) {
    console.error("Admin edit action error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ================= GET PENDING REQUESTS =================
const getPendingEditRequests = async (req, res) => {
  try {
    const query = `
      SELECT per.id, s.name as student_name, per.field_name, per.old_value, per.requested_value, per.reason, per.status
      FROM profile_edit_requests per
      JOIN students s ON s.id = per.student_id
      WHERE per.status = 'pending'
      ORDER BY per.id DESC
    `;
    const { rows } = await pool.query(query);
    res.json({ success: true, requests: rows });
  } catch (error) {
    console.error("Error fetching pending edit requests:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ================= GET EDIT REQUESTS BY STUDENT =================
const getEditRequests = async (req, res) => {
  try {
    const studentId = Number(req.query.id);
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ success: false, message: "Valid student id is required" });
    }

    const query = `
      SELECT per.id, s.id AS student_id, s.name as student_name, per.field_name, 
             per.old_value, per.requested_value, per.reason, per.status, per.action_at, per.requested_at
      FROM profile_edit_requests per
      JOIN students s ON s.id = per.student_id
      WHERE s.id = $1
      ORDER BY per.id DESC
    `;

    const { rows } = await pool.query(query, [studentId]);
    res.json({ success: true, requests: rows });
  } catch (error) {
    console.error("Error fetching edit requests:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getStudentProfile,
  insertStudent,
  updateStudentProfile,
  requestProfileEdit,
  handleEditRequest,
  getPendingEditRequests,
  getEditRequests,
};