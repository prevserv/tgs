const express = require("express");
const bcrypt = require("bcrypt");
const { z } = require("zod");
const { db } = require("../db/database");
const { signToken } = require("../utils/jwt");
const { normalizeCpf } = require("../utils/cpf");
const { createRateLimit } = require("../middlewares/rateLimit");

const router = express.Router();

const loginSchema = z
  .object({
    cpf: z.string().min(11).max(14),
    password: z.string().min(1).max(128),
  })
  .strict();

const loginRateLimit = createRateLimit({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  maxAttempts: Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 10),
  keySelector: (req) => {
    const cpf = req.body?.cpf ? String(req.body.cpf) : "unknown_cpf";
    return `${req.ip || "unknown_ip"}::${cpf}`;
  },
});

router.post("/login", loginRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados invalidos" });
  }

  const password = parsed.data.password;
  const cpf = normalizeCpf(parsed.data.cpf);

  if (cpf.length !== 11) {
    return res.status(400).json({ error: "CPF invalido" });
  }

  const userResult = await db.query("SELECT * FROM users WHERE cpf = $1", [cpf]);
  const user = userResult.rows[0];

  if (!user) {
    return res.status(400).json({ error: "CPF ou senha invalidos" });
  }

  if (Number(user.is_active) === 0) {
    return res.status(403).json({ error: "Usuario desativado" });
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    return res.status(400).json({ error: "CPF ou senha invalidos" });
  }

  const token = signToken({
    id: user.id,
    name: user.name,
    cpf: user.cpf,
    role: user.role,
  });

  return res.json({
    token,
    user: { id: user.id, name: user.name, cpf: user.cpf, role: user.role },
  });
});

module.exports = router;
