const { verifyToken } = require("../utils/jwt");
const { db } = require("../db/database");

async function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "Nao autenticado" });
  }

  try {
    const payload = verifyToken(token);

    if (!payload || !payload.id) {
      return res.status(401).json({ error: "Token invalido" });
    }

    const result = await db.query(
      "SELECT id, name, cpf, role, is_active FROM users WHERE id = $1",
      [payload.id],
    );
    const user = result.rows[0];

    if (!user || Number(user.is_active) === 0) {
      return res.status(401).json({ error: "Usuario inativo ou inexistente" });
    }

    req.user = {
      id: user.id,
      name: user.name,
      cpf: user.cpf,
      role: user.role,
    };

    return next();
  } catch {
    return res.status(401).json({ error: "Token invalido" });
  }
}

module.exports = { authRequired };
