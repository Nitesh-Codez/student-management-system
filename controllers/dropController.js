const db = require("../db");


exports.applyDrop = async (req, res) => {
  try {
    const { student_id, start_date, end_date, reason } = req.body;

    const query = `
      INSERT INTO profile_edit_requests
      (student_id, request_type, start_date, end_date, reason)
      VALUES ($1, 'DROP', $2, $3, $4)
      RETURNING *
    `;

    const { rows } = await db.query(query, [
      student_id,
      start_date,
      end_date,
      reason
    ]);

    res.json({
      success: true,
      message: "Drop request submitted",
      data: rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
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

    res.json({ success: true, data: rows });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};