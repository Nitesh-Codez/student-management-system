// src/db.js
const mysql = require("mysql2/promise"); // Promise-based

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.getConnection()
  .then(conn => {
    console.log("✅ MySQL Connected Successfully!");
    conn.release();
  })
  .catch(err => {
    console.error("DB Connection Error:", err);
  });

module.exports = db;
