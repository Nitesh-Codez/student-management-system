const db = require("../db");

// ================= CREATE / ASSIGN CLASS =================
// ================= CREATE / ASSIGN CLASS =================
exports.assignClass = async (req, res) => {
  try {
    const { teacher_id, class_id, subject_id, class_date, start_time, end_time } = req.body;

    // 1. ADVANCED CONFLICT CHECK
    // Hum check kar rahe hain: Ya toh Teacher busy hai, ya Class busy hai.
    const conflictSql = `
      SELECT id, teacher_id, class_name FROM teacher_assignments 
      WHERE class_date = $1 
      AND start_time = $2 
      AND (teacher_id = $3 OR class_name = $4)
    `;
    
    const conflictCheck = await db.query(conflictSql, [class_date, start_time, teacher_id, class_id]);

    if (conflictCheck.rows.length > 0) {
      const conflict = conflictCheck.rows[0];
      
      if (conflict.teacher_id == teacher_id) {
        return res.status(400).json({ 
          success: false, 
          message: `Class alreday assigned to this teacher at (${start_time}).` 
        });
      }
      
      if (conflict.class_name === class_id) {
        return res.status(400).json({ 
          success: false, 
          message: `Class ${class_id} at(${start_time}) already have another teacher.` 
        });
      }
    }

    // 2. Day nikalna
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dateObj = new Date(class_date);
    const day_of_week = days[dateObj.getDay()];

    // 3. Insert agar koi conflict nahi mila
    const sql = `
      INSERT INTO teacher_assignments 
      (teacher_id, class_name, subject_name, class_date, day_of_week, start_time, end_time) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await db.query(sql, [teacher_id, class_id, subject_id, class_date, day_of_week, start_time, end_time]);

    res.json({ success: true, message: "Class assigned successfully ✅" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// ================= GET ALL ASSIGNMENTS =================
exports.getAssignments = async (req, res) => {
  try {
    const sql = `
      SELECT ta.id, t.name AS teacher_name, ta.class_name, ta.subject_name,
             ta.class_date, ta.start_time, ta.end_time
      FROM teacher_assignments ta
      LEFT JOIN teachers t ON ta.teacher_id = t.id
      ORDER BY ta.class_date, ta.start_time
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
    const { teacher_id, class_id, subject_id, class_date, start_time, end_time } = req.body;

    const sql = `
      UPDATE teacher_assignments SET
        teacher_id = COALESCE($1, teacher_id),
        class_name = COALESCE($2, class_name),
        subject_name = COALESCE($3, subject_name),
        class_date = COALESCE($4, class_date),
        start_time = COALESCE($5, start_time),
        end_time = COALESCE($6, end_time)
      WHERE id = $7
    `;

    const result = await db.query(sql, [
      teacher_id,
      class_id,
      subject_id,
      class_date,
      start_time,
      end_time,
      id
    ]);

    if (!result.rowCount)
      return res.status(404).json({ success: false, message: "Assignment not found" });

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

    if (!result.rowCount)
      return res.status(404).json({ success: false, message: "Assignment not found" });

    res.json({ success: true, message: "Assignment deleted ✅" });

  } catch (err) {
    console.error("Delete Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= GET LECTURES FOR TEACHER =================
exports.getTeacherLectures = async (req, res) => {
  try {
    const { teacher_id } = req.params;

    const sql = `
      SELECT ta.id, t.name AS teacher_name, ta.class_name, ta.subject_name,
             ta.class_date, ta.start_time, ta.end_time
      FROM teacher_assignments ta
      LEFT JOIN teachers t ON ta.teacher_id = t.id
      WHERE ta.teacher_id = $1
      ORDER BY ta.class_date, ta.start_time
    `;

    const result = await db.query(sql, [teacher_id]);

    res.json({ success: true, assignments: result.rows });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= GET STUDENT LECTURES =================
exports.getStudentLectures = async (req, res) => {
  try {
    const { class_name, day } = req.params;

    const sql = `
      SELECT ta.id,
             t.name AS teacher_name,
             t.profile_photo,
             ta.class_name,
             ta.subject_name,
             ta.day_of_week,
             ta.start_time,
             ta.class_date,
             ta.end_time
      FROM teacher_assignments ta
      LEFT JOIN teachers t ON ta.teacher_id = t.id
      WHERE ta.class_name = $1
      AND ta.day_of_week = $2
      ORDER BY ta.start_time
    `;

    const result = await db.query(sql, [class_name, day]);

    res.json({ success: true, assignments: result.rows });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
