const { Pool } = require("pg");

// Pool config
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // ✅ ye line must hai
  },
});

// Test connection
(async () => {
  try {
    const res = await db.query("SELECT NOW()");
    console.log("✅ PostgreSQL Connected Successfully at:", res.rows[0].now);
  } catch (error) {
    console.error("❌ DB Connection Error FULL:", error);
  }
})();

module.exports = db;
