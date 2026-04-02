const db = require("../config/db");

exports.applyDrop = async (req, res) => {
  try {

    const { student_id, start_date, end_date } = req.body;

    // drop request save
    const query = `
      INSERT INTO student_drop (student_id, start_date, end_date)
      VALUES ($1, $2, $3)
    `;

    await db.query(query, [student_id, start_date, end_date]);

    res.json({
      success: true,
      message: "Drop applied successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};