const express = require("express");
const { authRequired } = require("../middlewares/auth");
const { db } = require("../db/database");

const router = express.Router();

router.get("/", authRequired, async (req, res) => {
  const result = await db.query(
    "SELECT id, name, cpf, role, is_active, created_at FROM users WHERE id = $1",
    [req.user.id],
  );
  const user = result.rows[0];

  if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });
  return res.json({ user });
});

module.exports = router;
