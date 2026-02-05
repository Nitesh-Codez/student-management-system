const db = require("../db");

// ================= CREATE / ASSIGN CLASS =================
exports.assignClass = async (req, res) => {
  try {
    const { teacher_id, class_id, subject_id, day_of_week, start_time, end_time } = req.body;

    if (!teacher_id || !class_id || !subject_id || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const sql = `
      INSERT INTO teacher_assignments
      (teacher_id, class_id, subject_id, day_of_week, start_time, end_time)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await db.query(sql, [teacher_id, class_id, subject_id, day_of_week, start_time, end_time]);

    res.json({ success: true, message: "Class assigned successfully ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= GET ALL ASSIGNMENTS =================
exports.getAssignments = async (req, res) => {
  try {
    const sql = `
      SELECT ta.id, t.name AS teacher_name, c.name AS class_name, s.name AS subject_name,
             ta.day_of_week, ta.start_time, ta.end_time
      FROM teacher_assignments ta
      LEFT JOIN teachers t ON ta.teacher_id = t.id
      LEFT JOIN classes c ON ta.class_id = c.id
      LEFT JOIN subjects s ON ta.subject_id = s.id
      ORDER BY ta.day_of_week, ta.start_time
    `;
    const result = await db.query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
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
        class_id = COALESCE($2, class_id),
        subject_id = COALESCE($3, subject_id),
        day_of_week = COALESCE($4, day_of_week),
        start_time = COALESCE($5, start_time),
        end_time = COALESCE($6, end_time)
      WHERE id = $7
    `;
    const result = await db.query(sql, [teacher_id, class_id, subject_id, day_of_week, start_time, end_time, id]);

    if (!result.rowCount) return res.status(404).json({ success: false, message: "Assignment not found" });

    res.json({ success: true, message: "Assignment updated ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
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
    console.error(err);
    res.status(500).json({ success: false });
  }
};



