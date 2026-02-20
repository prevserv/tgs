const express = require("express");
const { z } = require("zod");
const { db } = require("../db/database");
const { authRequired } = require("../middlewares/auth");

const router = express.Router();

router.get("/", authRequired, async (req, res) => {
  const schema = z.object({
    user_id: z.string().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Query inválida" });

  const requestedUserId = parsed.data.user_id
    ? Number(parsed.data.user_id)
    : null;

  let targetUserId = req.user.id;

  if (requestedUserId !== null) {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Sem permissão" });
    }
    targetUserId = requestedUserId;
  }

  const { rows } = await db.query(
    `
    SELECT id, user_id, type, occurred_at, latitude, longitude
    FROM times_entries
    WHERE user_id = $1
    ORDER BY occurred_at DESC, id DESC
    `,
    [targetUserId],
  );

  return res.json({ entries: rows });
});

router.get("/all", authRequired, async (req, res) => {
  if (req.user.role !== "ADMIN")
    return res.status(403).json({ error: "Sem permissão" });

  const { rows } = await db.query(
    `
    SELECT te.id, te.user_id, u.name, u.cpf, te.type, te.occurred_at, te.latitude, te.longitude
    FROM times_entries te
    JOIN users u ON u.id = te.user_id
    ORDER BY te.occurred_at DESC, te.id DESC
    `,
  );

  return res.json({ entries: rows });
});

module.exports = router;
