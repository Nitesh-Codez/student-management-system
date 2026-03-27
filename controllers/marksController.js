const db = require("../db"); // ✅ ONLY ONCE

// ================= GET CLASSES =================
const getClasses = async (req, res) => {
  try {
    const sql = `SELECT DISTINCT "class" FROM students ORDER BY "class"`;
    const { rows } = await db.query(sql);
    res.json({ success: true, classes: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error getting classes" });
  }
};

// ================= GET STUDENTS BY CLASS =================
const getStudentsByClass = async (req, res) => {
  try {
    const { className } = req.params;
    const sql = `SELECT id, name FROM students WHERE "class" = $1 ORDER BY name`;
    const { rows } = await db.query(sql, [className]);
    res.json({ success: true, students: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error getting students" });
  }
};

// ================= ADD MARKS =================
const addMarks = async (req, res) => {
  try {
    const { studentId, subject, marks, maxMarks, date } = req.body;

    if (!studentId || !subject || marks == null || !maxMarks || !date) {
      return res.json({ success: false, message: "Missing fields" });
    }

    // Student ka session fetch karo
    const studentSql = `SELECT session FROM students WHERE id = $1`;
    const { rows: studentRows } = await db.query(studentSql, [studentId]);

    if (studentRows.length === 0) {
      return res.json({ success: false, message: "Invalid student ID" });
    }

    const studentSession = studentRows[0].session;

    // Marks insert karo session ke saath
    const sql = `
      INSERT INTO marks (student_id, subject, total_marks, obtained_marks, test_date, session)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await db.query(sql, [studentId, subject, maxMarks, marks, date, studentSession]);

    res.json({ success: true, message: "Marks added successfully" });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error adding marks" });
  }
};
// ================= CHECK MARKS (STUDENT VIEW) =================
// ================= CHECK MARKS (STUDENT VIEW WITH CLASS & SESSION FILTER) =================
const checkMarks = async (req, res) => {
  try {
    const { studentId, studentName, session } = req.body; 

    if (!studentId || !studentName || !session) {
      return res.json({ success: false, message: "Student ID, Name and Session required" });
    }

    // 1. Pehle student validate karo aur uska session check karo
    const studentSql = `SELECT id, class, session FROM students WHERE id = $1 AND name = $2 AND session = $3`;
    const { rows: studentRows } = await db.query(studentSql, [studentId, studentName, session]);

    if (studentRows.length === 0) {
      return res.json({ success: false, message: "Invalid Student Details or Session Mismatch" });
    }

    const studentClass = studentRows[0].class;

    // 2. Marks fetch karo jahan marks ka session aur student ka session dono match ho
    const marksSql = `
      SELECT 
        m.id,
        s.name,
        s.class,
        m.subject,
        m.total_marks,
        m.obtained_marks,
        m.test_date,
        m.session as marks_session,
        s.session as student_session,
        CASE 
          WHEN m.obtained_marks >= m.total_marks * 0.33 
          THEN 'Pass' ELSE 'Fail' 
        END AS status
      FROM marks m
      JOIN students s ON s.id = m.student_id
      WHERE m.student_id = $1
        AND s.class = $2
        AND s.session = $3       -- Student table ka session match ho
        AND m.session = $3       -- Marks table ka session bhi match ho
      ORDER BY m.test_date DESC
    `;

    const { rows } = await db.query(marksSql, [studentId, studentClass, session]);

    if (rows.length === 0) {
      return res.json({ success: false, message: `No marks found for session ${session}` });
    }

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error fetching marks" });
  }
};
// ================= GET ALL MARKS (ADMIN) =================
const getAllMarks = async (req, res) => {
  try {
    const sql = `
      SELECT 
        m.id,
        s.name,
        s.class,
        m.subject,
        m.total_marks,
        m.obtained_marks,
        m.test_date,
        CASE 
          WHEN m.obtained_marks >= m.total_marks * 0.33
          THEN 'Pass'
          ELSE 'Fail'
        END AS status
      FROM marks m
      JOIN students s ON s.id = m.student_id
      ORDER BY s.class, s.name, m.test_date DESC
    `;

    const { rows } = await db.query(sql);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error getting all marks" });
  }
};


// ================= UPDATE MARKS =================
// ================= UPDATE MARKS =================
const updateMarks = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, marks, maxMarks, date } = req.body;

    // 🔹 Validation
    if (
      marks !== undefined && (typeof marks !== "number" || marks < 0) ||
      maxMarks !== undefined && (typeof maxMarks !== "number" || maxMarks <= 0) ||
      date !== undefined && isNaN(new Date(date))
    ) {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }

    // 🔹 Dynamic update fields
    const fields = [];
    const values = [];
    let idx = 1;

    if (subject !== undefined) { fields.push(`subject = $${idx++}`); values.push(subject); }
    if (marks !== undefined) { fields.push(`obtained_marks = $${idx++}`); values.push(marks); }
    if (maxMarks !== undefined) { fields.push(`total_marks = $${idx++}`); values.push(maxMarks); }
    if (date !== undefined) { fields.push(`test_date = $${idx++}`); values.push(date); }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    values.push(id);
    const sql = `UPDATE marks SET ${fields.join(", ")} WHERE id = $${idx}`;
    const result = await db.query(sql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    // 🔹 Optionally return updated record
    const updated = await db.query(`SELECT * FROM marks WHERE id = $1`, [id]);
    res.json({ success: true, message: "Marks updated successfully", data: updated.rows[0] });

  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ success: false, message: "Error updating marks" });
  }
};


// ================= DELETE MARKS =================
const deleteMarks = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "DELETE FROM marks WHERE id = $1",
      [id]
    );

    if (result.rowCount === 0) {
      return res.json({ success: false, message: "Record not found" });
    }

    res.json({ success: true, message: "Record deleted successfully" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.json({ success: false, message: "Error deleting marks" });
  }
};

// ================= EXPORTS =================
module.exports = {
  getClasses,
  getStudentsByClass,
  addMarks,
  checkMarks,
  updateMarks,
  getAllMarks,
  deleteMarks
};
