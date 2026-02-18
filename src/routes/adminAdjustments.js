const express = require("express");
const { z } = require("zod");
const { db } = require("../db/database");
const { authRequired } = require("../middlewares/auth");
const { requireRole } = require("../middlewares/requireRole");

const router = express.Router();

router.post(
  "/users/:id/close-journey",
  authRequired,
  requireRole("ADMIN"),
  (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId) || userId <= 0)
      return res.status(400).json({ error: "ID inválido" });

    const schema = z.object({
      occurred_at: z.string().min(1).optional(),
      latitude: z.number().nullable().optional(),
      longitude: z.number().nullable().optional(),
      alert_id: z.number().int().positive(),
      resolution_note: z.string().min(3).max(500),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const {
      latitude = null,
      longitude = null,
      alert_id,
      resolution_note,
    } = parsed.data;
    const occurred_at = parsed.data.occurred_at || new Date().toISOString();

    const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const alert = db
      .prepare(
        `SELECT id, user_id, type, time_in_entry_id, resolved_at
     FROM alerts
     WHERE id = ?`,
      )
      .get(alert_id);

    if (!alert) return res.status(404).json({ error: "Alerta não encontrado" });
    if (alert.resolved_at)
      return res.status(409).json({ error: "Alerta já resolvido" });
    if (alert.user_id !== userId)
      return res.status(400).json({ error: "Alerta não pertence ao usuário" });
    if (alert.type !== "JORNADA_INCONSISTENTE")
      return res.status(400).json({ error: "Tipo de alerta inválido" });

    const last = db
      .prepare(
        "SELECT id, type, occurred_at FROM times_entries WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      )
      .get(userId);

    if (!last || last.type !== "IN") {
      return res
        .status(409)
        .json({ error: "Não há jornada aberta (último registro não é IN)" });
    }

    if (alert.time_in_entry_id && alert.time_in_entry_id !== last.id) {
      return res
        .status(409)
        .json({ error: "A jornada aberta atual não corresponde ao alerta" });
    }

    const tx = db.transaction(() => {
      const insertOut = db.prepare(
        `INSERT INTO times_entries
        (user_id, type, occurred_at, latitude, longitude, note, adjusted_by, adjusted_at, adjustment_note, source_alert_id)
       VALUES
        (?, 'OUT', ?, ?, ?, ?, ?, datetime('now'), ?, ?)`,
      );

      const note = "ADMIN_ADJUST_CLOSE_JOURNEY";

      const outInfo = insertOut.run(
        userId,
        occurred_at,
        latitude,
        longitude,
        note,
        req.user.id,
        resolution_note,
        alert_id,
      );

      db.prepare(
        "UPDATE alerts SET resolved_at = datetime('now'), resolved_by = ?, resolution_note = ? WHERE id = ?",
      ).run(req.user.id, resolution_note, alert_id);

      const createdOut = db
        .prepare(
          `SELECT id, user_id, type, occurred_at, latitude, longitude, note,
              adjusted_by, adjusted_at, adjustment_note, source_alert_id
       FROM times_entries WHERE id = ?`,
        )
        .get(Number(outInfo.lastInsertRowid));

      const updatedAlert = db
        .prepare(
          `SELECT id, type, user_id, time_in_entry_id, severity, note, created_at, resolved_at, resolved_by, resolution_note
       FROM alerts WHERE id = ?`,
        )
        .get(alert_id);

      return { createdOut, updatedAlert };
    });

    const result = tx();
    return res.status(201).json(result);
  },
);

module.exports = router;
