const { db } = require("../db/database");

async function getActiveServiceOrdersForUser(userId, nowIso) {
  const result = await db.query(
    `
    SELECT
      so.id,
      so.title,
      so.expected_start,
      so.expected_duration_hours,
      so.status
    FROM service_orders so
    JOIN service_order_assignments sa ON sa.service_order_id = so.id
    WHERE sa.user_id = $1
      AND so.status = 'OPEN'
    ORDER BY so.expected_start DESC
  `,
    [userId],
  );

  const rows = result.rows;
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return [];

  return rows.filter((so) => {
    const start = Date.parse(so.expected_start);
    if (!Number.isFinite(start)) return false;
    const end = start + Number(so.expected_duration_hours) * 60 * 60 * 1000;
    return now >= start && now <= end;
  });
}

async function resolveSingleActiveServiceOrderId(userId, nowIso) {
  const active = await getActiveServiceOrdersForUser(userId, nowIso);
  if (active.length === 1) return active[0].id;
  return null;
}

async function assertUserCanUseServiceOrder(userId, serviceOrderId) {
  const result = await db.query(
    `
    SELECT so.id
    FROM service_orders so
    JOIN service_order_assignments sa ON sa.service_order_id = so.id
    WHERE so.id = $1
      AND sa.user_id = $2
      AND so.status = 'OPEN'
    LIMIT 1
  `,
    [serviceOrderId, userId],
  );

  return result.rows.length > 0;
}

module.exports = {
  getActiveServiceOrdersForUser,
  resolveSingleActiveServiceOrderId,
  assertUserCanUseServiceOrder,
};
