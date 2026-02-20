const { Pool } = require("pg");
const path = require("path");
const dotenv = require("dotenv");

// Load .env from current cwd and repository root fallback.
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: false });

// const connectionString = process.env.DATABASE_URL;
// if (!connectionString) {
//   throw new Error("DATABASE_URL is required");
// }

// const pool = new Pool({
//   connectionString,
//   ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : false,
// });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "25060"),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
    ca: process.env.DB_CA_CERT,
  },

  max: 10,                     // Maximum connections in pool
  idleTimeoutMillis: 30000,    // Close idle connections after 30s
  connectionTimeoutMillis: 5000 // Timeout for new connections
})

async function query(text, params = []) {
  return pool.query(text, params);
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx = {
      query(text, params = []) {
        return client.query(text, params);
      },
    };
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const db = { query, withTransaction };

module.exports = { db, pool };
