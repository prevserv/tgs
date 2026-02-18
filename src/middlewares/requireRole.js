function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Nao autenticado" });
    if (req.user.role !== role) {
      return res.status(403).json({ error: "Sem permissao" });
    }
    return next();
  };
}

module.exports = { requireRole };
