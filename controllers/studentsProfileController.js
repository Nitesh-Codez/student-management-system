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
        pincode, profile_photo, district, session, stream
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

// ================= INSERT STUDENT =================
const insertStudent = async (req, res) => {
  try {
    const {
      code, name, class: studentClass, mobile, address, role,
      father_name, mother_name, gender, dob, email, aadhaar,
      blood_group, category, city, state, pincode, district,
      session, stream
    } = req.body;

    if (!code || !name || !studentClass || !mobile) {
      return res.status(400).json({
        success: false,
        message: "Code, Name, Class and Mobile are required"
      });
    }

    const query = `
      INSERT INTO students (
        code, name, class, mobile, address, role,
        father_name, mother_name, gender, dob,
        email, aadhaar, blood_group, category,
        city, state, pincode, district, session, stream
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18, $19, $20
      )
      RETURNING *
    `;

    const values = [
      code, name, studentClass, mobile, address || null, role || "student",
      father_name || null, mother_name || null, gender || null, dob || null,
      email || null, aadhaar || null, blood_group || null, category || null,
      city || null, state || null, pincode || null, district || null,
      session || null, stream || null
    ];

    const { rows } = await pool.query(query, values);
    const student = rows[0];

    // -------- CLASS HISTORY SAVE --------
    await pool.query(
      `INSERT INTO student_class_history (student_id, class, year)
       VALUES ($1, $2, $3)`,
      [student.id, student.class, new Date().getFullYear()]
    );

    res.status(201).json({
      success: true,
      message: "Student inserted successfully",
      student: student
    });

  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "Student code already exists" });
    }
    console.error("Insert student error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ================= UPDATE STUDENT PROFILE =================
const updateStudentProfile = async (req, res) => {
  // Transaction shuru karenge taaki agar ek query fail ho toh kuch bhi update na ho
  const client = await pool.connect();
  
  try {
    const studentId = Number(req.params.id);

    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ success: false, message: "Valid Student ID required" });
    }

    const {
      code, name, class: studentClass, mobile, address,
      father_name, mother_name, gender, dob, email,
      aadhaar, blood_group, category, city, state,
      pincode, session, stream, district
    } = req.body;

    await client.query('BEGIN'); // Transaction Start

    // 1. OLD DATA FETCH
    const oldStudentRes = await client.query(
      'SELECT "class", session, update_count FROM students WHERE id=$1',
      [studentId]
    );

    if (oldStudentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const oldStudent = oldStudentRes.rows[0];
    const oldClass = oldStudent.class;
    const oldSession = oldStudent.session;
    let updateCount = Number(oldStudent.update_count) || 0;

    // 2. UPDATE LIMIT LOGIC
    if (session === oldSession) {
      if (updateCount >= 3) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: "❌ Update limit reached (Max 3 times in same session)"
        });
      }
      updateCount += 1;
    } else {
      updateCount = 1; // New session reset
    }

    // 3. SAVE HISTORY (Only if class changed)
    if (oldClass !== studentClass) {
      await client.query(
        `INSERT INTO student_class_history (student_id, "class", year)
         VALUES ($1, $2, $3)`,
        [studentId, oldClass, new Date().getFullYear()]
      );

      // 4. DELETE ATTENDANCE (Sirf class change hone par delete karna better hai, 
      // par agar aapko har update pe karna hai toh condition hata dena)
      await client.query(
        `DELETE FROM attendance WHERE student_id = $1`,
        [studentId]
      );
    }

    // 5. UPDATE STUDENT (Handling reserved keyword "class")
    const updateQuery = `
      UPDATE students SET
        code=$1, name=$2, "class"=$3, mobile=$4, address=$5,
        father_name=$6, mother_name=$7, gender=$8, dob=$9,
        email=$10, aadhaar=$11, blood_group=$12, category=$13,
        city=$14, state=$15, pincode=$16, session=$17, stream=$18, 
        district=$19, update_count=$20
      WHERE id=$21
      RETURNING *
    `;

    // Empty strings ko null handle karna zaroori hai for DATE fields
    const values = [
      code || null, name, studentClass, mobile || null, address || null,
      father_name || null, mother_name || null, gender || null, dob || null,
      email || null, aadhaar || null, blood_group || null, category || null,
      city || null, state || null, pincode || null, session || null, 
      stream || null, district || null, updateCount, studentId
    ];

    const { rows } = await client.query(updateQuery, values);
    
    await client.query('COMMIT'); // Transaction Success!

    res.json({
      success: true,
      message: "⚠️ Profile updated. Attendance reset!",
      remainingUpdates: 3 - updateCount,
      student: rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK'); // Error aane par rollback
    console.error("Update profile error details:", error.message);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  } finally {
    client.release(); // Connection free karein
  }
};
// ================= REQUEST PROFILE EDIT =================
const requestProfileEdit = async (req, res) => {
  try {
    const { student_id, field_name, requested_value, reason } = req.body;

    if (!student_id || !field_name || !reason) {
      return res.status(400).json({ success: false, message: "Student, field and reason are required.." });
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