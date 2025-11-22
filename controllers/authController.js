const bcrypt = require("bcryptjs");
const db = require("./db"); // Use existing connection

async function loginController(req, res) {
  const { name, password } = req.body;

  const query = "SELECT * FROM students WHERE name = ?";
  db.query(query, [name], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });

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
  });
}

module.exports = { loginController };
