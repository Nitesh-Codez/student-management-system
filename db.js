// db.js
const mysql = require("mysql2");

// Create a connection to MySQL using environment variables
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",         // Hostname
  port: process.env.DB_PORT || 3306,                // Port
  user: process.env.DB_USER || "root",              // Username
  password: process.env.DB_PASSWORD || "nitesh123@",// Password fallback
  database: process.env.DB_NAME || "tuition_db"     // Database fallback
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error("DB Connection Error:", err);
  } else {
    console.log("✅ MySQL Connected Successfully!");
  }
});

module.exports = db;
