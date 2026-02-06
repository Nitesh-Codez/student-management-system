const db = require("../db");

// ================= CREATE / ASSIGN CLASS =================
exports.assignClass = async (req, res) => {
  try {
    // React se ab hum class_name aur subject_name bhejenge
    const { teacher_id, class_id, subject_id, day_of_week, start_time, end_time } = req.body;

    if (!teacher_id || !class_id || !subject_id || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const sql = `
      INSERT INTO teacher_assignments 
      (teacher_id, class_name, subject_name, day_of_week, start_time, end_time) 
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    // Yahan class_id aur subject_id variable hi use kar rahe hain jo req.body se aaye hain
    await db.query(sql, [teacher_id, class_id, subject_id, day_of_week, start_time, end_time]);

    res.json({ success: true, message: "Class assigned successfully ✅" });
  } catch (err) {
    console.error("Save Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= GET ALL ASSIGNMENTS =================
exports.getAssignments = async (req, res) => {
  try {
    // Ab humein classes ya subjects table se JOIN karne ki zaroorat nahi hai 
    // kyunki naam ab seedha teacher_assignments table mein hi hai.
    const sql = `
      SELECT ta.id, t.name AS teacher_name, ta.class_name, ta.subject_name,
             ta.day_of_week, ta.start_time, ta.end_time
      FROM teacher_assignments ta
      LEFT JOIN teachers t ON ta.teacher_id = t.id
      ORDER BY ta.day_of_week, ta.start_time
    `;
    const result = await db.query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= UPDATE ASSIGNMENT =================
exports.updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { teacher_id, class_id, subject_id, day_of_week, start_time, end_time } = req.body;

    const sql = `
      UPDATE teacher_assignments SET
        teacher_id = COALESCE($1, teacher_id),
        class_name = COALESCE($2, class_name),
        subject_name = COALESCE($3, subject_name),
        day_of_week = COALESCE($4, day_of_week),
        start_time = COALESCE($5, start_time),
        end_time = COALESCE($6, end_time)
      WHERE id = $7
    `;
    const result = await db.query(sql, [teacher_id, class_id, subject_id, day_of_week, start_time, end_time, id]);

    if (!result.rowCount) return res.status(404).json({ success: false, message: "Assignment not found" });

    res.json({ success: true, message: "Assignment updated ✅" });
  } catch (err) {
    console.error("Update Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= DELETE ASSIGNMENT =================
exports.deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`DELETE FROM teacher_assignments WHERE id=$1`, [id]);

    if (!result.rowCount) return res.status(404).json({ success: false, message: "Assignment not found" });

    res.json({ success: true, message: "Assignment deleted ✅" });
  } catch (err) {
    console.error("Delete Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= GET LECTURES FOR A SPECIFIC TEACHER =================
// teacherAssignmentController.js mein add karein
exports.getStudentLectures = async (req, res) => {
  try {
    const { class_name } = req.params;
    const sql = `
      SELECT ta.id, t.name AS teacher_name, ta.class_name, ta.subject_name,
             ta.day_of_week, ta.start_time, ta.end_time
      FROM teacher_assignments ta
      LEFT JOIN teachers t ON ta.teacher_id = t.id
      WHERE ta.class_name = $1
      ORDER BY ta.start_time
    `;
    const result = await db.query(sql, [class_name]);
    res.json({ success: true, assignments: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};