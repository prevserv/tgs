const { db } = require("./database");

db.exec(`
  CREATE TABLE IF NOT EXISTS service_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    location_text TEXT,
    expected_start TEXT NOT NULL,
    expected_duration_hours INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS service_order_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(service_order_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_so_status ON service_orders(status);
  CREATE INDEX IF NOT EXISTS idx_so_assign_user ON service_order_assignments(user_id);
`);

console.log("Migration 006 OK");
