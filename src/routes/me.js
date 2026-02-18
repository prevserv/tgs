const express = require("express");
const { authRequired } = require("../middlewares/auth");
const { db } = require("../db/database");

const router = express.Router();

router.get("/", authRequired, (req, res) => {
  const user = db
    .prepare(
      "SELECT id, name, cpf, role, is_active, created_at FROM users WHERE id = ?",
    )
    .get(req.user.id);

  if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

  return res.json({ user });
});

module.exports = router;
