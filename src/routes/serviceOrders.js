const express = require("express");
const { z } = require("zod");
const { db } = require("../db/database");
const { authRequired } = require("../middlewares/auth");
const { requireRole } = require("../middlewares/requireRole");

const router = express.Router();

router.post("/", authRequired, requireRole("ADMIN"), async (req, res) => {
  const schema = z.object({
    title: z.string().min(3),
    description: z.string().optional(),
    location_text: z.string().optional(),
    expected_start: z.string().min(1),
    expected_duration_hours: z.number().int().positive(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados invalidos", details: parsed.error.flatten() });
  }

  const {
    title,
    description = null,
    location_text = null,
    expected_start,
    expected_duration_hours,
  } = parsed.data;

  const insertResult = await db.query(
    `
      INSERT INTO service_orders
      (title, description, location_text, expected_start, expected_duration_hours, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [title, description, location_text, expected_start, expected_duration_hours, req.user.id],
  );
  const id = insertResult.rows[0].id;

  const createdResult = await db.query("SELECT * FROM service_orders WHERE id = $1", [id]);
  return res.status(201).json({ service_order: createdResult.rows[0] });
});

router.get("/", authRequired, requireRole("ADMIN"), async (req, res) => {
  const result = await db.query(
    `
      SELECT so.*, u.name AS created_by_name
      FROM service_orders so
      JOIN users u ON u.id = so.created_by
      ORDER BY so.created_at DESC
    `,
  );
  return res.json({ service_orders: result.rows });
});

router.post("/:id/assign", authRequired, requireRole("ADMIN"), async (req, res) => {
  const serviceOrderId = Number(req.params.id);

  const schema = z.object({ user_id: z.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados invalidos", details: parsed.error.flatten() });
  }

  const { user_id } = parsed.data;
  const soResult = await db.query("SELECT id FROM service_orders WHERE id = $1", [serviceOrderId]);
  if (!soResult.rows[0]) return res.status(404).json({ error: "OS nao encontrada" });

  const userResult = await db.query("SELECT id FROM users WHERE id = $1", [user_id]);
  if (!userResult.rows[0]) return res.status(404).json({ error: "Usuario nao encontrado" });

  try {
    await db.query(
      "INSERT INTO service_order_assignments (service_order_id, user_id) VALUES ($1, $2)",
      [serviceOrderId, user_id],
    );
  } catch (err) {
    if (err && err.code === "23505") {
      return res.status(409).json({ error: "Usuario ja atribuido a OS" });
    }
    throw err;
  }

  return res.status(201).json({ message: "Usuario atribuido com sucesso" });
});

router.patch("/:id/close", authRequired, requireRole("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "ID invalido" });
  }

  const soResult = await db.query("SELECT id, status FROM service_orders WHERE id = $1", [id]);
  const so = soResult.rows[0];
  if (!so) return res.status(404).json({ error: "OS nao encontrada" });
  if (so.status === "CLOSED") return res.status(409).json({ error: "OS ja esta encerrada" });

  await db.query(
    `
      UPDATE service_orders
      SET status = 'CLOSED', closed_at = NOW(), closed_by = $1
      WHERE id = $2
    `,
    [req.user.id, id],
  );

  const updatedResult = await db.query("SELECT * FROM service_orders WHERE id = $1", [id]);
  return res.json({ service_order: updatedResult.rows[0] });
});

module.exports = router;
