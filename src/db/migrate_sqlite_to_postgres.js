const path = require("path");
const Database = require("better-sqlite3");
const { Client } = require("pg");

const SQLITE_DB_PATH =
  process.env.SQLITE_DB_PATH || path.join(__dirname, "app.db");

function normalizeTs(value) {
  if (value == null || value === "") return null;
  return value;
}

async function setSequence(client, table, column = "id") {
  await client.query(
    `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX(${column}) FROM ${table}), 1), true)`,
    [table, column],
  );
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to migrate data to PostgreSQL");
  }

  const sqlite = new Database(SQLITE_DB_PATH, { readonly: true });
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("BEGIN");

    const users = sqlite
      .prepare(
        "SELECT id, name, cpf, password_hash, role, is_active, created_at FROM users ORDER BY id",
      )
      .all();
    for (const row of users) {
      await client.query(
        `INSERT INTO users (id, name, cpf, password_hash, role, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          row.name,
          row.cpf,
          row.password_hash,
          row.role,
          row.is_active ?? 1,
          normalizeTs(row.created_at),
        ],
      );
    }

    const serviceOrders = sqlite
      .prepare(
        "SELECT id, title, description, location_text, expected_start, expected_duration_hours, status, created_by, created_at, closed_at, closed_by FROM service_orders ORDER BY id",
      )
      .all();
    for (const row of serviceOrders) {
      await client.query(
        `INSERT INTO service_orders
         (id, title, description, location_text, expected_start, expected_duration_hours, status, created_by, created_at, closed_at, closed_by)
         VALUES
         ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8, COALESCE($9::timestamptz, NOW()), $10::timestamptz, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          row.title,
          row.description,
          row.location_text,
          normalizeTs(row.expected_start),
          row.expected_duration_hours,
          row.status || "OPEN",
          row.created_by,
          normalizeTs(row.created_at),
          normalizeTs(row.closed_at),
          row.closed_by,
        ],
      );
    }

    const assignments = sqlite
      .prepare(
        "SELECT id, service_order_id, user_id, assigned_at FROM service_order_assignments ORDER BY id",
      )
      .all();
    for (const row of assignments) {
      await client.query(
        `INSERT INTO service_order_assignments (id, service_order_id, user_id, assigned_at)
         VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()))
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.service_order_id, row.user_id, normalizeTs(row.assigned_at)],
      );
    }

    const timeEntries = sqlite
      .prepare(
        "SELECT id, user_id, type, occurred_at, latitude, longitude, created_at, note, adjusted_by, adjusted_at, adjustment_note, source_alert_id, service_order_id FROM times_entries ORDER BY id",
      )
      .all();
    for (const row of timeEntries) {
      await client.query(
        `INSERT INTO times_entries
         (id, user_id, type, occurred_at, latitude, longitude, created_at, note, adjusted_by, adjusted_at, adjustment_note, source_alert_id, service_order_id)
         VALUES
         ($1, $2, $3, $4::timestamptz, $5, $6, COALESCE($7::timestamptz, NOW()), $8, $9, $10::timestamptz, $11, $12, $13)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          row.user_id,
          row.type,
          normalizeTs(row.occurred_at),
          row.latitude,
          row.longitude,
          normalizeTs(row.created_at),
          row.note,
          row.adjusted_by,
          normalizeTs(row.adjusted_at),
          row.adjustment_note,
          row.source_alert_id,
          row.service_order_id,
        ],
      );
    }

    const alerts = sqlite
      .prepare(
        "SELECT id, type, user_id, time_in_entry_id, severity, note, created_at, resolved_at, resolved_by, resolution_note FROM alerts ORDER BY id",
      )
      .all();
    for (const row of alerts) {
      await client.query(
        `INSERT INTO alerts
         (id, type, user_id, time_in_entry_id, severity, note, created_at, resolved_at, resolved_by, resolution_note)
         VALUES
         ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()), $8::timestamptz, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          row.type,
          row.user_id,
          row.time_in_entry_id,
          row.severity,
          row.note,
          normalizeTs(row.created_at),
          normalizeTs(row.resolved_at),
          row.resolved_by,
          row.resolution_note,
        ],
      );
    }

    await setSequence(client, "users");
    await setSequence(client, "service_orders");
    await setSequence(client, "service_order_assignments");
    await setSequence(client, "times_entries");
    await setSequence(client, "alerts");

    await client.query("COMMIT");
    console.log("Data migration SQLite -> PostgreSQL OK");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Data migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    sqlite.close();
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration error:", err.message);
  process.exit(1);
});
