const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const dotenv = require("dotenv");

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: false });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run PostgreSQL migration");
  }

  const schemaPath = path.join(__dirname, "postgres", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  const client = new Client({ connectionString });
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
