const mysql = require("mysql2");
const bcrypt = require("bcryptjs");

// DB connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) console.log("DB Connection Error:", err);
  else console.log("✅ MySQL Connected Successfully!");
});

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
