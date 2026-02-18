const express = require("express");
const { z } = require("zod");
const { db } = require("../db/database");
const { authRequired } = require("../middlewares/auth");
const { ensureInconsistencyAlert } = require("../utils/inconsistency");
const {
  resolveSingleActiveServiceOrderId,
  assertUserCanUseServiceOrder,
} = require("../utils/activeServiceOrder");

const router = express.Router();

router.post("/clock", authRequired, (req, res) => {
  const schema = z.object({
    type: z.enum(["IN", "OUT"]),
    occurred_at: z.string().min(1),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    service_order_id: z.number().int().positive().nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Dados inválidos", details: parsed.error.flatten() });
  }

  const {
    type,
    occurred_at,
    latitude = null,
    longitude = null,
    service_order_id = null,
  } = parsed.data;

  const userId = req.user.id;

  const nowIso = new Date().toISOString();
  let soId = service_order_id;
  if (soId === null || soId === undefined) {
    soId = resolveSingleActiveServiceOrderId(userId, nowIso);
  }

  if (soId != null) {
    const ok = assertUserCanUseServiceOrder(userId, soId);
    if (!ok)
      return res
        .status(403)
        .json({ error: "OS inválida ou não atribuída ao usuário" });
  }
  const inconsistency = ensureInconsistencyAlert(userId, nowIso);

  const last = db
    .prepare(
      "SELECT type FROM times_entries WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    )
    .get(userId);

  const isInJourney = !!last && last.type === "IN";

  if (type === "IN" && isInJourney) {
    return res.status(409).json({ error: "Usuário já está em jornada" });
  }

  if (type === "OUT" && !isInJourney) {
    return res.status(409).json({ error: "Usuário não está em jornada" });
  }

  const stmt = db.prepare(
    "INSERT INTO times_entries (user_id, type, occurred_at, latitude, longitude, service_order_id) VALUES (?, ?, ?, ?, ?, ?)",
  );

  const info = stmt.run(
    userId,
    type,
    occurred_at,
    latitude,
    longitude,
    soId ?? null,
  );

  return res.status(201).json({
    id: Number(info.lastInsertRowid),
    user_id: userId,
    type,
    occurred_at,
    latitude,
    longitude,
    service_order_id: soId ?? null,
    inconsistency: inconsistency.inconsistent ? inconsistency : null,
  });
});

router.get("/status", authRequired, (req, res) => {
  const userId = req.user.id;

  const nowIso = new Date().toISOString();
  const inconsistency = ensureInconsistencyAlert(userId, nowIso);

  const last = db
    .prepare(
      "SELECT type, occurred_at FROM times_entries WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    )
    .get(userId);

  const isInJourney = !!last && last.type === "IN";

  return res.json({
    in_journey: isInJourney,
    last: last || null,
    inconsistency: inconsistency.inconsistent ? inconsistency : null,
  });
});

module.exports = router;
