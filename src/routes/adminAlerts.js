const express = require("express");
const { z } = require("zod");
const { db } = require("../db/database");
const { authRequired } = require("../middlewares/auth");
const { requireRole } = require("../middlewares/requireRole");

const router = express.Router();

router.get("/alerts", authRequired, requireRole("ADMIN"), (req, res) => {
  const schema = z.object({
    status: z.enum(["open", "resolved"]).optional(),
    user_id: z.string().optional(),
    limit: z.string().optional(),
    offset: z.string().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Query inválida" });

  const status = parsed.data.status || "open";
  const userId = parsed.data.user_id ? Number(parsed.data.user_id) : null;
  const limit = Math.min(Number(parsed.data.limit || 20), 100);
  const offset = Math.max(Number(parsed.data.offset || 0), 0);

  const where = [];
  const params = [];

  if (status === "open") where.push("a.resolved_at IS NULL");
  else where.push("a.resolved_at IS NOT NULL");

  if (userId) {
    where.push("a.user_id = ?");
    params.push(userId);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = db
    .prepare(`SELECT COUNT(*) as n FROM alerts a ${whereSql}`)
    .get(...params).n;

  const rows = db
    .prepare(
      `
      SELECT
        a.id, a.type, a.user_id, a.time_in_entry_id, a.severity,
        a.note, a.created_at, a.resolved_at, a.resolved_by, a.resolution_note,
        u.name as user_name, u.cpf as user_cpf
      FROM alerts a
      JOIN users u ON u.id = a.user_id
      ${whereSql}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?
      `,
    )
    .all(...params, limit, offset);

  return res.json({ total, limit, offset, alerts: rows });
});

router.patch(
  "/alerts/:id/resolve",
  authRequired,
  requireRole("ADMIN"),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ error: "ID inválido" });

    const schema = z.object({
      resolution_note: z.string().min(3).max(500),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Dados inválidos", details: parsed.error.flatten() });

    const alert = db
      .prepare("SELECT id, resolved_at FROM alerts WHERE id = ?")
      .get(id);

    if (!alert) return res.status(404).json({ error: "Alerta não encontrado" });
    if (alert.resolved_at)
      return res.status(409).json({ error: "Alerta já resolvido" });

    db.prepare(
      "UPDATE alerts SET resolved_at = datetime('now'), resolved_by = ?, resolution_note = ? WHERE id = ?",
    ).run(req.user.id, parsed.data.resolution_note, id);

    const updated = db
      .prepare(
        `SELECT id, type, user_id, time_in_entry_id, severity, note, created_at, resolved_at, resolved_by, resolution_note
       FROM alerts WHERE id = ?`,
      )
      .get(id);

    return res.json({ alert: updated });
  },
);

module.exports = router;
