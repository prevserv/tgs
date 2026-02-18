const { db } = require("./database");

function tryExec(sql) {
  try {
    db.exec(sql);
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("duplicate column name")) return;
    throw e;
  }
}

tryExec(`ALTER TABLE times_entries ADD COLUMN note TEXT;`);
tryExec(`ALTER TABLE times_entries ADD COLUMN adjusted_by INTEGER;`);
tryExec(`ALTER TABLE times_entries ADD COLUMN adjusted_at TEXT;`);
tryExec(`ALTER TABLE times_entries ADD COLUMN adjustment_note TEXT;`);
tryExec(`ALTER TABLE times_entries ADD COLUMN source_alert_id INTEGER;`);

console.log("Migration 004 OK");
