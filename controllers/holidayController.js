const pool = require("../db");

// Add Holiday (Admin)
exports.addHoliday = async (req, res) => {
  try {
    const { title, description, holiday_date } = req.body;

    const result = await pool.query(
      "INSERT INTO holidays (title, description, holiday_date) VALUES ($1,$2,$3) RETURNING *",
      [title, description, holiday_date]
    );

    res.json({
      success: true,
      holiday: result.rows[0],
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};


// Get All Holidays (Student)
exports.getHolidays = async (req, res) => {
  try {

    const result = await pool.query(
      "SELECT * FROM holidays ORDER BY holiday_date DESC"
    );

    res.json({
      success: true,
      holidays: result.rows,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};