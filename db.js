const { Pool } = require("pg");

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

(async () => {
  try {
    await db.query("SELECT NOW()");
    console.log("✅ PostgreSQL Connected Successfully!");
  } catch (error) {
    console.error("❌ DB Connection Error FULL:", error);
  }
})();

module.exports = db;
