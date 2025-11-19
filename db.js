// db.js
const mysql = require("mysql2");

const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "nitesh123@",
  database: process.env.DB_NAME || "tuition_db"
});

db.connect((err) => {
  if (err) console.log("DB Connection Error:", err);
  else console.log("✅ MySQL Connected Successfully!");
});

module.exports = db;
