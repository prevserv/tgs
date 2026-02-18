const { db } = require("../db/database");

function getActiveServiceOrdersForUser(userId, nowIso) {
  const rows = db
    .prepare(
      `
    SELECT
      so.id,
      so.title,
      so.expected_start,
      so.expected_duration_hours,
      so.status
    FROM service_orders so
    JOIN service_order_assignments sa ON sa.service_order_id = so.id
    WHERE sa.user_id = ?
      AND so.status = 'OPEN'
    ORDER BY so.expected_start DESC
  `,
    )
    .all(userId);

  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return [];

  // Considera "ativa" se now está dentro da janela [start, start + duration]
  // (MVP: sem tolerância; podemos adicionar depois)
  return rows.filter((so) => {
    const start = Date.parse(so.expected_start);
    if (!Number.isFinite(start)) return false;
    const end = start + so.expected_duration_hours * 60 * 60 * 1000;
    return now >= start && now <= end;
  });
}

function resolveSingleActiveServiceOrderId(userId, nowIso) {
  const active = getActiveServiceOrdersForUser(userId, nowIso);
  if (active.length === 1) return active[0].id;
  return null; // 0 ou >1: não decide sozinho
}

function assertUserCanUseServiceOrder(userId, serviceOrderId) {
  const row = db
    .prepare(
      `
    SELECT so.id
    FROM service_orders so
    JOIN service_order_assignments sa ON sa.service_order_id = so.id
    WHERE so.id = ?
      AND sa.user_id = ?
      AND so.status = 'OPEN'
    LIMIT 1
  `,
    )
    .get(serviceOrderId, userId);

  return !!row;
}

module.exports = {
  getActiveServiceOrdersForUser,
  resolveSingleActiveServiceOrderId,
  assertUserCanUseServiceOrder,
};
