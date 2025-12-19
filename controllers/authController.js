const bcrypt = require("bcryptjs");
const db = require("../db"); // Promise-based DB

async function loginController(req, res) {
  const { name, password } = req.body;

  try {
    // 🔍 student table se data nikal rahe
    const [results] = await db.query(
      "SELECT id, name, password, role, class FROM students WHERE name = ?",
      [name]
    );

    if (results.length === 0) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const user = results[0];

    // 🔐 password match
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // ✅ SUCCESS RESPONSE (IMPORTANT FIX)
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        class: user.class, // 🔥 THIS IS THE KEY FIX
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
