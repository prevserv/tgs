const express = require("express");
const bcrypt = require("bcrypt");
const { z } = require("zod");
const { db } = require("../db/database");
const { authRequired } = require("../middlewares/auth");
const { requireRole } = require("../middlewares/requireRole");
const { normalizeCpf } = require("../utils/cpf");

const router = express.Router();

router.post("/users", authRequired, requireRole("ADMIN"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    cpf: z.string().min(11).max(14),
    password: z.string().min(6),
    role: z.enum(["ADMIN", "USER"]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados invalidos", details: parsed.error.flatten() });
  }

  const { name, password, role } = parsed.data;
  const cpf = normalizeCpf(parsed.data.cpf);
  if (cpf.length !== 11) return res.status(400).json({ error: "CPF invalido" });

  const existResult = await db.query("SELECT id FROM users WHERE cpf = $1", [cpf]);
  if (existResult.rows[0]) return res.status(409).json({ error: "CPF ja cadastrado" });

  const password_hash = bcrypt.hashSync(password, 10);
  const insertResult = await db.query(
    "INSERT INTO users (name, cpf, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
    [name, cpf, password_hash, role],
  );

  return res.status(201).json({ id: Number(insertResult.rows[0].id), name, cpf, role });
});

router.get("/users", authRequired, requireRole("ADMIN"), async (req, res) => {
  const schema = z.object({
    q: z.string().optional(),
    limit: z.string().optional(),
    offset: z.string().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Query invalida" });

  const q = (parsed.data.q || "").trim();
  const limit = Math.min(Number(parsed.data.limit || 20), 100);
  const offset = Math.max(Number(parsed.data.offset || 0), 0);

  if (q) {
    const like = `%${q}%`;
    const totalResult = await db.query(
      "SELECT COUNT(*)::int AS n FROM users WHERE name ILIKE $1 OR cpf ILIKE $2",
      [like, like],
    );
    const rowsResult = await db.query(
      `
        SELECT id, name, cpf, role, is_active, created_at
        FROM users
        WHERE name ILIKE $1 OR cpf ILIKE $2
        ORDER BY id DESC
        LIMIT $3 OFFSET $4
      `,
      [like, like, limit, offset],
    );
    return res.json({
      total: totalResult.rows[0].n,
      limit,
      offset,
      users: rowsResult.rows,
    });
  }

  const totalResult = await db.query("SELECT COUNT(*)::int AS n FROM users");
  const rowsResult = await db.query(
    `
      SELECT id, name, cpf, role, is_active, created_at
      FROM users
      ORDER BY id DESC
      LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  );

  return res.json({
    total: totalResult.rows[0].n,
    limit,
    offset,
    users: rowsResult.rows,
  });
});

router.patch(
  "/users/:id/active",
  authRequired,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "ID invalido" });
    }

    const schema = z.object({ is_active: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos", details: parsed.error.flatten() });
    }

    const existsResult = await db.query("SELECT id FROM users WHERE id = $1", [id]);
    if (!existsResult.rows[0]) {
      return res.status(404).json({ error: "Usuario nao encontrado" });
    }

    const isActiveInt = parsed.data.is_active ? 1 : 0;
    await db.query("UPDATE users SET is_active = $1 WHERE id = $2", [isActiveInt, id]);

    const updatedResult = await db.query(
      "SELECT id, name, cpf, role, is_active, created_at FROM users WHERE id = $1",
      [id],
    );
    return res.json({ user: updatedResult.rows[0] });
  },
);

module.exports = router;
