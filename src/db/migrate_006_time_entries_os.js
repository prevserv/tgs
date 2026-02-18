const { db } = require("./database");

try {
  db.exec(`
    ALTER TABLE times_entries ADD COLUMN service_order_id INTEGER;
  `);
} catch (e) {
  const msg = String(e.message || "");
  if (!msg.includes("duplicate column name")) throw e;
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_times_entries_so ON times_entries(service_order_id);
`);

console.log("Migration 006 OK");
