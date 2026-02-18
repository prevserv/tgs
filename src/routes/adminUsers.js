const express = require("express");
const bcrypt = require("bcrypt");
const { z } = require("zod");
const { db } = require("../db/database");
const { authRequired } = require("../middlewares/auth");
const { requireRole } = require("../middlewares/requireRole");
const { normalizeCpf } = require("../utils/cpf");

const router = express.Router();

router.post("/users", authRequired, requireRole("ADMIN"), (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    cpf: z.string().min(11).max(14),
    password: z.string().min(6),
    role: z.enum(["ADMIN", "USER"]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Dados inválidos",
      details: parsed.error.flatten(),
    });
  }

  const { name, password, role } = parsed.data;
  const cpf = normalizeCpf(parsed.data.cpf);
  if (cpf.length !== 11) {
    return res.status(400).json({ error: "CPF inválido" });
  }
  const exist = db.prepare("SELECT id FROM users WHERE cpf = ?").get(cpf);
  if (exist) return res.status(409).json({ error: "CPF já cadastrado" });

  const password_hash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare(
    "INSERT INTO users (name, cpf, password_hash, role) VALUES (?, ?, ?, ?)",
  );
  const info = stmt.run(name, cpf, password_hash, role);

  return res.status(201).json({
    id: Number(info.lastInsertRowid),
    name,
    cpf,
    role,
  });
});

router.get("/users", authRequired, requireRole("ADMIN"), (req, res) => {
  const schema = z.object({
    q: z.string().optional(),
    limit: z.string().optional(),
    offset: z.string().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Query inválida" });

  const q = (parsed.data.q || "").trim();
  const limit = Math.min(Number(parsed.data.limit || 20), 100);
  const offset = Math.max(Number(parsed.data.offset || 0), 0);

  let rows;
  let total;

  if (q) {
    const like = `%${q}%`;

    total = db
      .prepare(
        `SELECT COUNT(*) as n FROM users WHERE name LIKE ? OR cpf LIKE ?`,
      )
      .get(like, like).n;

    rows = db
      .prepare(
        `SELECT id, name, cpf, role, is_active, created_at
    FROM users
    WHERE name LIKE ? OR cpf LIKE ? ORDER BY id DESC
    LIMIT ? OFFSET ?`,
      )
      .all(like, like, limit, offset);
  } else {
    total = db.prepare(`SELECT COUNT(*) as n FROM users`).get().n;

    rows = db
      .prepare(
        `SELECT id, name, cpf, role, is_active, created_at FROM users ORDER BY id DESC LIMIT ? OFFSET ?`,
      )
      .all(limit, offset);
  }

  return res.json({
    total,
    limit,
    offset,
    users: rows,
  });
});

router.patch(
  "/users/:id/active",
  authRequired,
  requireRole("ADMIN"),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ error: "ID inválido" });

    const schema = z.object({
      is_active: z.boolean(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Dados inválidos", details: parsed.error.flatten() });

    const exists = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
    if (!exists)
      return res.status(404).json({ error: "Usuário não encontrado" });

    const isActiveInt = parsed.data.is_active ? 1 : 0;

    db.prepare("UPDATE users SET is_active = ? WHERE id = ?").run(
      isActiveInt,
      id,
    );

    const updated = db
      .prepare(
        "SELECT id, name, cpf, role, is_active, created_at FROM users WHERE id = ?",
      )
      .get(id);

    return res.json({ user: updated });
  },
);

module.exports = router;
