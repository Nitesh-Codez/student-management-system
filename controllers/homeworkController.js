const db = require("../db"); // MySQL connection

// ------------------ Get All Students ------------------
exports.getAllStudents = (req, res) => {
  const sql = "SELECT id, name, class FROM students ORDER BY name";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, students: results });
  });
};

// ------------------ Get Homework by Class ------------------
exports.getHomeworkByClass = (req, res) => {
  const className = req.params.class;
  if (!className) return res.status(400).json({ success: false, message: "Class is required" });

  const sql = `
    SELECT h.id, h.title, h.student_id, s.name AS student_name, h.class, h.status, h.date_assigned
    FROM homework h
    JOIN students s ON h.student_id = s.id
    WHERE h.class = ?
    ORDER BY h.date_assigned DESC
  `;
  db.query(sql, [className], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, homework: results });
  });
};

// ------------------ Add Homework ------------------
exports.addHomework = (req, res) => {
  const { title, class: className, date_assigned, student_id } = req.body;

  if (!title || !className || !date_assigned)
    return res.status(400).json({ success: false, message: "All fields required" });

  let sql, values;

  if (student_id) {
    // Add homework for selected student only
    sql = `INSERT INTO homework (title, student_id, class, status, date_assigned) VALUES (?, ?, ?, 'not done', ?)`;
    values = [title, student_id, className, date_assigned];
    db.query(sql, values, (err) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: "Homework assigned to student successfully" });
    });
  } else {
    // Add homework for all students in the class
    db.query(`SELECT id FROM students WHERE class = ?`, [className], (err, students) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      if (students.length === 0)
        return res.status(400).json({ success: false, message: "No students in this class" });

      values = students.map(s => [title, s.id, className, 'not done', date_assigned]);
      sql = `INSERT INTO homework (title, student_id, class, status, date_assigned) VALUES ?`;
      db.query(sql, [values], (err2) => {
        if (err2) return res.status(500).json({ success: false, message: err2.message });
        res.json({ success: true, message: "Homework assigned to all students successfully" });
      });
    });
  }
};

// ------------------ Update Homework Status ------------------
exports.updateStatus = (req, res) => {
  const { homeworkId, status } = req.body;
  if (!homeworkId || !status) return res.status(400).json({ success: false, message: "Homework ID & status required" });

  const sql = `UPDATE homework SET status = ? WHERE id = ?`;
  db.query(sql, [status, homeworkId], (err) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, message: "Status updated" });
  });
};
