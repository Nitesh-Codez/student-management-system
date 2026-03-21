const bcrypt = require("bcryptjs");
const db = require("../db");

async function loginController(req, res) {
  const { name, password } = req.body;

  try {
    // 🔍 Query mein "session" aur "stream" bhi add kiya hai
    const results = await db.query(
      'SELECT id, name, password, role, "class", session,joining_date, stream FROM students WHERE name = $1',
      [name]
    );

    if (results.rows.length === 0) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const user = results.rows[0];

    // 🔐 Password Comparison
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // ✅ SUCCESS RESPONSE - Ab isme saara data hai jo Dashboard ko chahiye
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        class: user.class,
        session: user.session, // 🔥 Dashboard filters ke liye
        stream: user.stream, 
        joining_date: user.joining_date,     // 🔥 Dashboard filters ke liye
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

module.exports = { loginController };