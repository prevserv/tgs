const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { getPgConnectionConfig } = require("./pgConfig");

async function main() {
  const schemaPath = path.join(__dirname, "postgres", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  const client = new Client(getPgConnectionConfig());

  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query(schemaSql);
    await client.query("COMMIT");
    console.log("PostgreSQL schema migration OK");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("PostgreSQL migration failed:", err.message);
  process.exit(1);
});
