const { db } = require("../db/database");

const MAX_HOURS_MS = 12 * 60 * 60 * 1000;
const TOL_HOURS_MS = 13 * 60 * 60 * 1000;

function ensureInconsistencyAlert(userId, nowIso) {
  const last = db
    .prepare(
      "SELECT id, type, occurred_at FROM times_entries WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    )
    .get(userId);

  if (!last || last.type !== "IN") return { inconsistent: false };

  const inTime = Date.parse(last.occurred_at);
  const nowTime = Date.parse(nowIso);
  if (!Number.isFinite(inTime) || !Number.isFinite(nowTime))
    return { inconsistent: false };

  const elapsed = nowTime - inTime;
  if (elapsed < MAX_HOURS_MS) return { inconsistent: false };

  const severity = elapsed >= TOL_HOURS_MS ? 2 : 1;
  const elapsedHours = Math.round((elapsed / (60 * 60 * 1000)) * 10) / 10;

  const note = `JORNADA_INCONSISTENTE: IN aberto há ~${elapsedHours}h (máx=12h, tol=13h)`;

  const existing = db
    .prepare(
      `SELECT id, severity
       FROM alerts
       WHERE type = 'JORNADA_INCONSISTENTE'
         AND user_id = ?
         AND time_in_entry_id = ?
         AND resolved_at IS NULL
       LIMIT 1`,
    )
    .get(userId, last.id);

  if (!existing) {
    const info = db
      .prepare(
        `INSERT INTO alerts (type, user_id, time_in_entry_id, severity, note)
         VALUES ('JORNADA_INCONSISTENTE', ?, ?, ?, ?)`,
      )
      .run(userId, last.id, severity, note);

    return {
      inconsistent: true,
      created_alert: true,
      alert_id: Number(info.lastInsertRowid),
      severity,
    };
  }

  if (existing.severity !== severity) {
    db.prepare("UPDATE alerts SET severity = ?, note = ? WHERE id = ?").run(
      severity,
      note,
      existing.id,
    );
  }

  return {
    inconsistent: true,
    created_alert: false,
    alert_id: existing.id,
    severity,
  };
}

module.exports = { ensureInconsistencyAlert };
