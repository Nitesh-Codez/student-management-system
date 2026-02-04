const bcrypt = require("bcryptjs");
const db = require("../db"); // Promise-based PostgreSQL connection

async function loginController(req, res) {
  const { name, password } = req.body;

  console.log("Login attempt:", { name, password }); // 🔍 Request body check

  try {
    const results = await db.query(
      'SELECT id, name, password, role, "class" FROM students WHERE name = $1',
      [name]
    );

    console.log("DB results:", results.rows); // 🔍 DB se kya aa raha

    if (results.rows.length === 0) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const user = results.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    console.log("Password match result:", isMatch); // 🔍 Password match

    if (!isMatch) {
      return res.json({
        success: false,
        message: "Invalid credentials",
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        class: user.class,
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
