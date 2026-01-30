const db = require("../db"); // Promise-based PostgreSQL pool

// Get unique classes from students table
exports.getClasses = async (req, res) => {
  try {
    const sql = `SELECT DISTINCT "class" FROM students ORDER BY "class"`;
    const { rows } = await db.query(sql);
    res.json({ success: true, classes: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error getting classes" });
  }
};

// Get students list by class
exports.getStudentsByClass = async (req, res) => {
  try {
    const { className } = req.params;
    const sql = `SELECT id, name FROM students WHERE "class" = $1`;
    const { rows } = await db.query(sql, [className]);
    res.json({ success: true, students: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error getting students" });
  }
};

// Add marks
exports.addMarks = async (req, res) => {
  try {
    const { studentId, subject, marks, maxMarks, date } = req.body;

    if (!studentId || !subject || !marks || !maxMarks || !date) {
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

// Check marks by student ID
exports.checkMarks = async (req, res) => {
  try {
    const { studentId, studentName } = req.body;

    if (!studentId || !studentName) {
      return res.json({ success: false, message: "Student ID and Name required" });
    }

    // Step 1: Check student exists with SAME id and SAME name
    const studentSql = `SELECT id FROM students WHERE id = $1 AND name = $2`;
    const { rows: studentRows } = await db.query(studentSql, [studentId, studentName]);

    if (studentRows.length === 0) {
      return res.json({ success: false, message: "Invalid Student ID or Name!" });
    }

    // Step 2: Fetch marks
    const marksSql = `
      SELECT id, subject AS subject_name, total_marks, obtained_marks, test_date,
      CASE WHEN obtained_marks >= total_marks * 0.33 THEN 'Pass' ELSE 'Fail' END AS status
      FROM marks
      WHERE student_id = $1
      ORDER BY test_date DESC
    `;
    const { rows } = await db.query(marksSql, [studentId]);

    if (rows.length === 0) {
      return res.json({ success: false, message: "No marks found!" });
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching marks" });
  }
};

//========= Get all marks ============
// Get all marks entries (Admin)
exports.getAllMarks = async (req, res) => {
  try {
    const sql = `
      SELECT 
        m.id,
        s.id AS student_id,
        s.name AS student_name,
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
      ORDER BY m.test_date DESC
    `;

    const { rows } = await db.query(sql);

    if (rows.length === 0) {
      return res.json({ success: false, message: "No marks entries found" });
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching marks list" });
  }
};


// ============================================================
// ================= EDIT MARKS (ADMIN) =======================
// ============================================================
async function updateMarks(req, res) {
  try {
    const { id } = req.params;
    const { marks, maxMarks, date } = req.body;

    if (!marks || !maxMarks) {
      return res.status(400).json({
        success: false,
        message: "Marks and Total Marks are required",
      });
    }

    const status = Number(marks) >= Number(maxMarks) * 0.33
      ? "PASS"
      : "FAIL";

    // check entry exists
    const { rows: existing } = await db.query(
      `SELECT * FROM marks WHERE id=$1`,
      [id]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: "Marks entry not found",
      });
    }

    const { rows } = await db.query(
      `
      UPDATE marks
      SET obtained_marks = $1,
          total_marks = $2,
          test_date = $3,
          status = $4
      WHERE id = $5
      RETURNING *;
      `,
      [
        marks,
        maxMarks,
        date || existing[0].test_date,
        status,
        id,
      ]
    );

    res.json({
      success: true,
      message: "Marks updated successfully ✅",
      data: rows[0],
    });

  } catch (err) {
    console.error("MARKS UPDATE ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

module.exports = {
  updateMarks,
};
