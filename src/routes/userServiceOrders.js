const express = require("express");
const { db } = require("../db/database");
const { authRequired } = require("../middlewares/auth");
const { getActiveServiceOrdersForUser } = require("../utils/activeServiceOrder");

const router = express.Router();

router.get("/my", authRequired, async (req, res) => {
  const result = await db.query(
    `
      SELECT so.*
      FROM service_orders so
      JOIN service_order_assignments sa ON sa.service_order_id = so.id
      WHERE sa.user_id = $1
      ORDER BY so.expected_start DESC
    `,
    [req.user.id],
  );
  return res.json({ service_orders: result.rows });
});

router.get("/my/active", authRequired, async (req, res) => {
  const nowIso = new Date().toISOString();
  const active = await getActiveServiceOrdersForUser(req.user.id, nowIso);
  return res.json({ service_orders: active, now: nowIso });
});

module.exports = router;
