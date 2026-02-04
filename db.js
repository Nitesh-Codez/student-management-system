const { Pool } = require("pg");

// ================= POOL CONFIG =================
const connectionString = process.env.DATABASE_URL;

// Force IPv4 host extraction from DATABASE_URL
const host = connectionString.split("@")[1].split(":")[0];

const db = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // must for Supabase
  },
  host, // IPv4 force
});

// ================= TEST CONNECTION =================
(async () => {
  try {
    const res = await db.query("SELECT NOW()");
    console.log("✅ PostgreSQL Connected Successfully at:", res.rows[0].now);
  } catch (error) {
    console.error("❌ DB Connection Error FULL:", error);
  }
})();

module.exports = db;
