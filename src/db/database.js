const { Pool } = require("pg");
const { getPgConnectionConfig } = require("./pgConfig");

const pool = new Pool({
  ...getPgConnectionConfig(),
  max: 10, // Maximum connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout for new connections
});

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
