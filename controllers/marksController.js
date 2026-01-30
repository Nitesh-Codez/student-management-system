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

    const sql = `
      INSERT INTO marks (student_id, subject, total_marks, obtained_marks, test_date)
      VALUES ($1, $2, $3, $4, $5)
    `;

    await db.query(sql, [studentId, subject, maxMarks, marks, date]);

    res.json({ success: true, message: "Marks added successfully" });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error adding marks" });
  }
};

// ================= CHECK MARKS (STUDENT VIEW) =================
const checkMarks = async (req, res) => {
  try {
    const { studentId, studentName } = req.body;

    if (!studentId || !studentName) {
      return res.json({ success: false, message: "Student ID and Name required" });
    }

    const studentSql =
      `SELECT id FROM students WHERE id = $1 AND name = $2`;
    const { rows: studentRows } =
      await db.query(studentSql, [studentId, studentName]);

    if (studentRows.length === 0) {
      return res.json({ success: false, message: "Invalid Student ID or Name" });
    }

    const marksSql = `
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
          THEN 'Pass' ELSE 'Fail' 
        END AS status
      FROM marks m
      JOIN students s ON s.id = m.student_id
      WHERE m.student_id = $1
      ORDER BY m.test_date DESC
    `;

    const { rows } = await db.query(marksSql, [studentId]);

    if (rows.length === 0) {
      return res.json({ success: false, message: "No marks found" });
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
const updateMarks = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, marks, maxMarks, date } = req.body;

    // Check karein ki purana data fetch karke missing fields fill karein 
    // ya SQL query ko thoda flexible banayein.
    const sql = `
      UPDATE marks
      SET subject = COALESCE($1, subject),
          obtained_marks = COALESCE($2, obtained_marks),
          total_marks = COALESCE($3, total_marks),
          test_date = COALESCE($4, test_date)
      WHERE id = $5
    `;

    const result = await db.query(sql, [subject, marks, maxMarks, date, id]);

    if (result.rowCount === 0) {
      return res.json({ success: false, message: "Record not found" });
    }

    res.json({ success: true, message: "Marks updated successfully" });
  } catch (err) {
    console.error("Update Error:", err);
    res.json({ success: false, message: "Error updating marks" });
  }
};
// ================= EXPORTS =================
module.exports = {
  getClasses,
  getStudentsByClass,
  addMarks,
  checkMarks,
  updateMarks,
  getAllMarks
};
