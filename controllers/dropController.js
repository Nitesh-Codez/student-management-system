const db = require("../db");

exports.applyDrop = async (req, res) => {
  try {
    const { student_id, start_date, end_date, reason } = req.body;

    if (!student_id || !start_date || !end_date || !reason) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // 🔥 Transaction start (important)
    await db.query("BEGIN");

    // ✅ 1. Save actual data in student_drop
    const dropQuery = `
      INSERT INTO student_drop (student_id, start_date, end_date)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const dropRes = await db.query(dropQuery, [
      student_id,
      start_date,
      end_date
    ]);

    // ✅ 2. Save request in profile_edit_requests
    const requestQuery = `
      INSERT INTO profile_edit_requests
      (student_id, request_type, start_date, end_date, reason)
      VALUES ($1, 'DROP', $2, $3, $4)
      RETURNING *
    `;

    const requestRes = await db.query(requestQuery, [
      student_id,
      start_date,
      end_date,
      reason
    ]);

    // 🔥 Commit transaction
    await db.query("COMMIT");

    res.json({
      success: true,
      message: "Drop request submitted successfully",
      drop: dropRes.rows[0],
      request: requestRes.rows[0]
    });

  } catch (error) {
    await db.query("ROLLBACK"); // ❗ important
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

exports.getMyDropRequests = async (req, res) => {
  try {
    const { student_id } = req.query;

    const query = `
      SELECT * FROM profile_edit_requests
      WHERE student_id = $1 AND request_type = 'DROP'
      ORDER BY requested_at DESC
    `;

    const { rows } = await db.query(query, [student_id]);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};