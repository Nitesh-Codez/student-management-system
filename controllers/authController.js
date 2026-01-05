const bcrypt = require("bcryptjs");
const db = require("../db"); // Promise-based PostgreSQL connection

async function loginController(req, res) {
  const { name, password } = req.body;

  try {
    // 🔍 students table se data nikal rahe
    const results = await db.query(
      'SELECT id, name, password, role, "class" FROM students WHERE name = $1',
      [name]
    );

    if (results.rows.length === 0) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const user = results.rows[0];

    // 🔐 password match
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // ✅ SUCCESS RESPONSE
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        class: user.class, // 🔥 PostgreSQL me bhi same
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
