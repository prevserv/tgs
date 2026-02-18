const express = require("express");
const { db } = require("../db/database");
const { authRequired } = require("../middlewares/auth");
const {
  getActiveServiceOrdersForUser,
} = require("../utils/activeServiceOrder");

const router = express.Router();

router.get("/my", authRequired, (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT so.*
    FROM service_orders so
    JOIN service_order_assignments sa ON sa.service_order_id = so.id
    WHERE sa.user_id = ?
    ORDER BY so.expected_start DESC
  `,
    )
    .all(req.user.id);

  return res.json({ service_orders: rows });
});

router.get("/my/active", authRequired, (req, res) => {
  const nowIso = new Date().toISOString();
  const active = getActiveServiceOrdersForUser(req.user.id, nowIso);
  return res.json({ service_orders: active, now: nowIso });
});

module.exports = router;
