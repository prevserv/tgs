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

tryExec(`ALTER TABLE service_orders ADD COLUMN closed_at TEXT;`);
tryExec(`ALTER TABLE service_orders ADD COLUMN closed_by INTEGER;`);

console.log("Migration 007 OK");
