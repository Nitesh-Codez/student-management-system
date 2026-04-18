const db = require("../db");

const db = require("../db");

exports.applyDrop = async (req, res) => {
  const client = await db.connect();

  try {
    const { student_id, start_date, end_date, reason, drop_type } = req.body;

    // ✅ Validation
    if (!student_id || !reason || !drop_type) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing"
      });
    }

    // ✅ Logic based on type
    let finalStart = start_date;
    let finalEnd = end_date;

    if (drop_type === "1_day") {
      finalEnd = start_date; // same day
    }

    if (drop_type === "permanent") {
      finalStart = null;
      finalEnd = null;
    }

    await client.query("BEGIN");

    // ✅ 1. student_drop
    const dropQuery = `
      INSERT INTO student_drop 
      (student_id, start_date, end_date, drop_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const dropRes = await client.query(dropQuery, [
      student_id,
      finalStart,
      finalEnd,
      drop_type
    ]);

    // ✅ 2. profile_edit_requests
    const requestQuery = `
      INSERT INTO profile_edit_requests
      (student_id, field_name, request_type, start_date, end_date, reason, drop_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const requestRes = await client.query(requestQuery, [
      student_id,
      "drop",
      "DROP",
      finalStart,
      finalEnd,
      reason,
      drop_type
    ]);

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Drop request submitted",
      drop: dropRes.rows[0],
      request: requestRes.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("DROP ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  } finally {
    client.release();
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