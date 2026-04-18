const db = require("../db");


exports.applyDrop = async (req, res) => {
  const client = await db.connect(); // 🔥 better transaction handling

  try {
    const { student_id, start_date, end_date, reason } = req.body;

    // ✅ Validation
    if (!student_id || !start_date || !end_date || !reason) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // ✅ Date validation
    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({
        success: false,
        message: "Start date cannot be after end date"
      });
    }

    await client.query("BEGIN");

    // ✅ 1. Insert into student_drop
    const dropQuery = `
      INSERT INTO student_drop (student_id, start_date, end_date)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const dropRes = await client.query(dropQuery, [
      student_id,
      start_date,
      end_date
    ]);

    // ✅ 2. Insert into profile_edit_requests (FIXED)
    const requestQuery = `
      INSERT INTO profile_edit_requests
      (student_id, field_name, request_type, start_date, end_date, reason)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const requestRes = await client.query(requestQuery, [
      student_id,
      "drop",       // ✅ field_name fix
      "DROP",       // request_type
      start_date,
      end_date,
      reason
    ]);

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Drop request submitted successfully",
      drop: dropRes.rows[0],
      request: requestRes.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("DROP ERROR:", error.message); // ✅ better debug

    res.status(500).json({
      success: false,
      message: "Server error"
    });

  } finally {
    client.release(); // 🔥 important
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