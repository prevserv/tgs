const { db } = require("./database");

db.exec("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1");

console.log("Migration 02 ok.");
