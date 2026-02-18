const express = require("express");
const { z } = require("zod");
const { db } = require("../db/database");
const { authRequired } = require("../middlewares/auth");
const { requireRole } = require("../middlewares/requireRole");

const router = express.Router();

router.get("/alerts", authRequired, requireRole("ADMIN"), async (req, res) => {
  const schema = z.object({
    status: z.enum(["open", "resolved"]).optional(),
    user_id: z.string().optional(),
    limit: z.string().optional(),
    offset: z.string().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Query invalida" });

  const status = parsed.data.status || "open";
  const userId = parsed.data.user_id ? Number(parsed.data.user_id) : null;
  const limit = Math.min(Number(parsed.data.limit || 20), 100);
  const offset = Math.max(Number(parsed.data.offset || 0), 0);

  const where = [];
  const params = [];
  let idx = 1;

  if (status === "open") where.push("a.resolved_at IS NULL");
  else where.push("a.resolved_at IS NOT NULL");

  if (userId) {
    where.push(`a.user_id = $${idx++}`);
    params.push(userId);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalResult = await db.query(
    `SELECT COUNT(*)::int as n FROM alerts a ${whereSql}`,
    params,
  );

  const rowsResult = await db.query(
    `
      SELECT
        a.id, a.type, a.user_id, a.time_in_entry_id, a.severity,
        a.note, a.created_at, a.resolved_at, a.resolved_by, a.resolution_note,
        u.name as user_name, u.cpf as user_cpf
      FROM alerts a
      JOIN users u ON u.id = a.user_id
      ${whereSql}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $${idx++} OFFSET $${idx}
    `,
    [...params, limit, offset],
  );

  return res.json({
    total: totalResult.rows[0].n,
    limit,
    offset,
    alerts: rowsResult.rows,
  });
});

router.patch(
  "/alerts/:id/resolve",
  authRequired,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "ID invalido" });
    }

    const schema = z.object({
      resolution_note: z.string().min(3).max(500),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos", details: parsed.error.flatten() });
    }

    const alertResult = await db.query(
      "SELECT id, resolved_at FROM alerts WHERE id = $1",
      [id],
    );
    const alert = alertResult.rows[0];
    if (!alert) return res.status(404).json({ error: "Alerta nao encontrado" });
    if (alert.resolved_at) return res.status(409).json({ error: "Alerta ja resolvido" });

    await db.query(
      "UPDATE alerts SET resolved_at = NOW(), resolved_by = $1, resolution_note = $2 WHERE id = $3",
      [req.user.id, parsed.data.resolution_note, id],
    );

    const updatedResult = await db.query(
      `
        SELECT id, type, user_id, time_in_entry_id, severity, note,
               created_at, resolved_at, resolved_by, resolution_note
        FROM alerts WHERE id = $1
      `,
      [id],
    );
    return res.json({ alert: updatedResult.rows[0] });
  },
);

module.exports = router;
