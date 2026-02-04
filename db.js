const { Pool } = require("pg");

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // must for Neon
  },
});

(async () => {
  try {
    const res = await db.query("SELECT NOW()");
    console.log("✅ PostgreSQL Connected Successfully at:", res.rows[0].now);
  } catch (error) {
    console.error("❌ DB Connection Error FULL:", error);
  }
})();

module.exports = db;
