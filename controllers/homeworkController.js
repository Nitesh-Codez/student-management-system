const db = require("../db"); // MySQL connection

// ------------------ Get Classes ------------------
exports.getClasses = (req, res) => {
  const sql = "SELECT DISTINCT class FROM students";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, classes: results.map(r => r.class) });
  });
};

// ------------------ Get Homework by Class ------------------
exports.getHomeworkByClass = (req, res) => {
  const className = req.params.class;
  const sql = `SELECT * FROM homework WHERE class = ?`;
  db.query(sql, [className], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, homework: results });
  });
};

// ------------------ Add Homework ------------------
exports.addHomework = (req, res) => {
  const { title, class: className, date_assigned } = req.body;

  if (!title || !className || !date_assigned)
    return res.status(400).json({ success: false, message: "All fields required" });

  // Fetch all students of this class
  db.query(`SELECT id FROM students WHERE class = ?`, [className], (err, students) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (students.length === 0)
      return res.status(400).json({ success: false, message: "No students in this class" });

    const values = students.map(s => [title, s.id, className, 'not done', date_assigned]);
    const sql = `INSERT INTO homework (title, student_id, class, status, date_assigned) VALUES ?`;

    db.query(sql, [values], (err2) => {
      if (err2) return res.status(500).json({ success: false, message: err2.message });

      // Return inserted homework
      const insertedHomework = values.map(v => ({
        title: v[0],
        student_id: v[1],
        class: v[2],
        status: v[3],
        date_assigned: v[4]
      }));

      res.json({ success: true, message: "Homework assigned successfully", homework: insertedHomework });
    });
  });
};

// ------------------ Update Status ------------------
exports.updateStatus = (req, res) => {
  const { homeworkId, status } = req.body;
  const sql = `UPDATE homework SET status = ? WHERE id = ?`;
  db.query(sql, [status, homeworkId], (err) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, message: "Status updated" });
  });
};
