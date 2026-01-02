const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,

  ssl: {
    ca: fs.readFileSync(path.join(__dirname, "tidb-ca.pem")),
    rejectUnauthorized: true
  }
});

db.getConnection()
  .then(conn => {
    console.log("✅ MySQL Connected Successfully!");
    conn.release();
  })
  .catch(err => {
    console.error("❌ DB Connection Error:", err.message);
  });

module.exports = db;
