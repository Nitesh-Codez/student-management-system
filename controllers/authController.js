// src/controllers/authController.js
const bcrypt = require("bcryptjs");
const db = require("../db"); // Promise DB

async function loginController(req, res) {
  const { name, password } = req.body;

  try {
    const [results] = await db.query("SELECT * FROM students WHERE name = ?", [name]);

    if (results.length > 0) {
      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
        res.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
      } else {
        res.json({ success: false, message: "Invalid credentials" });
      }
    } else {
      res.json({ success: false, message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { loginController };
