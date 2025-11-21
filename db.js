// db.js
const mysql = require("mysql2");

// Railway MySQL connection using DATABASE_URL if exists
let db;

if (process.env.DATABASE_URL) {
  // Using full connection URL from Railway
  db = mysql.createConnection(process.env.DATABASE_URL);
} else {
  // Local fallback
  db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "nitesh123@",
    database: process.env.DB_NAME || "tuition_db"
  });
}

// Connect to MySQL
db.connect((err) => {
  if (err) console.error("DB Connection Error:", err);
  else console.log("✅ MySQL Connected Successfully!");
});

module.exports = db;
