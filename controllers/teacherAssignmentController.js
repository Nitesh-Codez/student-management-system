const db = require("../db");

// ================= CREATE / ASSIGN CLASS =================
exports.assignClass = async (req, res) => {
  try {
    const { teacher_id, class_id, subject_id, class_date, start_time, end_time } = req.body;

    // class_date se Day nikalna (e.g., 'Monday')
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dateObj = new Date(class_date);
    const day_of_week = days[dateObj.getDay()];

    const sql = `
      INSERT INTO teacher_assignments 
      (teacher_id, class_name, subject_name, class_date, day_of_week, start_time, end_time) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await db.query(sql, [
      teacher_id,
      class_id,
      subject_id,
      class_date,
      day_of_week, // Yeh mismatch fix kar dega
      start_time,
      end_time
    ]);

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
    const { class_name } = req.params;

    const sql = `
      SELECT ta.id,
             t.name AS teacher_name,
             t.profile_photo,
             ta.class_name,
             ta.subject_name,
             ta.class_date,
             ta.start_time,
             ta.end_time
      FROM teacher_assignments ta
      LEFT JOIN teachers t ON ta.teacher_id = t.id
      WHERE ta.class_name = $1
      ORDER BY ta.class_date, ta.start_time
    `;

    const result = await db.query(sql, [class_name]);

    res.json({ success: true, assignments: result.rows });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
