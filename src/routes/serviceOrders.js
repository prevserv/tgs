const express = require("express");
const { z } = require("zod");
const { db } = require("../db/database");
const { authRequired } = require("../middlewares/auth");
const { requireRole } = require("../middlewares/requireRole");

const router = express.Router();

/* Criar OS */
router.post("/", authRequired, requireRole("ADMIN"), (req, res) => {
  const schema = z.object({
    title: z.string().min(3),
    description: z.string().optional(),
    location_text: z.string().optional(),
    expected_start: z.string().min(1),
    expected_duration_hours: z.number().int().positive(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Dados inválidos", details: parsed.error.flatten() });
  }

  const {
    title,
    description = null,
    location_text = null,
    expected_start,
    expected_duration_hours,
  } = parsed.data;

  const stmt = db.prepare(`
    INSERT INTO service_orders
    (title, description, location_text, expected_start, expected_duration_hours, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    title,
    description,
    location_text,
    expected_start,
    expected_duration_hours,
    req.user.id,
  );

  const created = db
    .prepare("SELECT * FROM service_orders WHERE id = ?")
    .get(Number(info.lastInsertRowid));

  return res.status(201).json({ service_order: created });
});

/* Listar OS */
router.get("/", authRequired, requireRole("ADMIN"), (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT so.*, u.name as created_by_name
    FROM service_orders so
    JOIN users u ON u.id = so.created_by
    ORDER BY so.created_at DESC
  `,
    )
    .all();

  return res.json({ service_orders: rows });
});

/* Atribuir usuário */
router.post("/:id/assign", authRequired, requireRole("ADMIN"), (req, res) => {
  const serviceOrderId = Number(req.params.id);

  const schema = z.object({
    user_id: z.number().int().positive(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Dados inválidos", details: parsed.error.flatten() });
  }

  const { user_id } = parsed.data;

  const so = db
    .prepare("SELECT id FROM service_orders WHERE id = ?")
    .get(serviceOrderId);
  if (!so) return res.status(404).json({ error: "OS não encontrada" });

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(user_id);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

  try {
    db.prepare(
      `
      INSERT INTO service_order_assignments (service_order_id, user_id)
      VALUES (?, ?)
    `,
    ).run(serviceOrderId, user_id);
  } catch {
    return res.status(409).json({ error: "Usuário já atribuído à OS" });
  }

  return res.status(201).json({ message: "Usuário atribuído com sucesso" });
});

router.patch("/:id/close", authRequired, requireRole("ADMIN"), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0)
    return res.status(400).json({ error: "ID inválido" });

  const so = db
    .prepare("SELECT id, status FROM service_orders WHERE id = ?")
    .get(id);
  if (!so) return res.status(404).json({ error: "OS não encontrada" });
  if (so.status === "CLOSED")
    return res.status(409).json({ error: "OS já está encerrada" });

  db.prepare(
    `
    UPDATE service_orders
    SET status = 'CLOSED',
        closed_at = datetime('now'),
        closed_by = ?
    WHERE id = ?
  `,
  ).run(req.user.id, id);

  const updated = db
    .prepare("SELECT * FROM service_orders WHERE id = ?")
    .get(id);
  return res.json({ service_order: updated });
});

module.exports = router;
