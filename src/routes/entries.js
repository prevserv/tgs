const express = require("express");
const { z, number } = require("zod");
const { db } = require("../db/database");
const { authRequired } = require("../middlewares/auth");

const router = express.Router();

router.get("/", authRequired, (req, res) => {
  const schema = z.object({
    user_id: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Query inválida" });

  const requestedUserId = parsed.data.user_id
    ? Number(parsed.data.user_id)
    : null;

  let targetUserId = req.user.id;

  if (requestedUserId !== null) {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ error: "Sem permissão" });
    targetUserId = requestedUserId;
  }

  const from = parsed.data.from || "0000-01-01T00:00:00.000Z";
  const to = parsed.data.to || "9999-12-31T23:59:59.999Z";

  const rows = db
    .prepare(
      `SELECT id, user_id, type, occurred_at, latitude, longitude,
       note, adjusted_by, adjusted_at, adjustment_note, source_alert_id
 FROM times_entries WHERE user_id = ? AND occurred_at >= ? AND occurred_at <= ? ORDER BY occurred_at DESC, id DESC`,
    )
    .all(targetUserId, from, to);

  return res.json({
    entries: rows,
    filter: { user_id: targetUserId, from, to },
  });
});

router.get("/all", authRequired, (req, res) => {
  if (req.user.role !== "ADMIN")
    return res.status(403).json({ error: "Sem permissão" });

  const schema = z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Query inválida" });

  const from = parsed.data.from || "0000-01-01T00:00:00.000Z";
  const to = parsed.data.to || "9999-12-31T23:59:59.999Z";

  const rows = db
    .prepare(
      `SELECT te.id, te.user_id, u.name, u.cpf, te.type, te.occurred_at, te.latitude, te.longitude, te.note, te.adjusted_by, te.adjusted_at, te.adjustment_note, te.source_alert_id
       FROM times_entries te
       JOIN users u ON u.id = te.user_id
       WHERE te.occurred_at >= ? AND te.occurred_at <= ?
       ORDER BY te.occurred_at DESC, te.id DESC`,
    )
    .all(from, to);

  return res.json({ entries: rows, filter: { from, to } });
});

module.exports = router;
