const { Pool } = require("pg");

// ================= POOL CONFIG =================
const connectionString = process.env.DATABASE_URL;

// Force IPv4 extraction
const url = new URL(connectionString);
const host = url.hostname; // yeh automatically IPv4 lega agar available

const db = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // must for Supabase
  },
  host, // force IPv4
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
