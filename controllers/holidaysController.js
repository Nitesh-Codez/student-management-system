const pool = require("../db");

// =========================
// ADD HOLIDAY
// =========================
const addHoliday = async (req, res) => {
  try {
    const { title, description, holiday_date } = req.body;

    if (!title || !holiday_date) {
      return res.status(400).json({
        message: "Title and holiday date are required",
      });
    }

    const result = await pool.query(
      `INSERT INTO public.holidays
       (title, description, holiday_date)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [title, description || null, holiday_date]
    );

    res.status(201).json({
      message: "Holiday added successfully",
      holiday: result.rows[0],
    });
  } catch (error) {
    console.error("Add holiday error:", error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// =========================
// GET ALL HOLIDAYS
// =========================
const getHolidays = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, description, holiday_date, created_at
       FROM public.holidays
       ORDER BY holiday_date ASC`
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Get holidays error:", error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  addHoliday,
  getHolidays,
};