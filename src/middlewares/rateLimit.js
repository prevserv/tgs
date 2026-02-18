const attempts = new Map();

function cleanupExpired(nowMs) {
  for (const [key, entry] of attempts.entries()) {
    if (nowMs > entry.resetAt) {
      attempts.delete(key);
    }
  }
}

function createRateLimit({
  windowMs = 15 * 60 * 1000,
  maxAttempts = 10,
  keySelector = (req) => req.ip || "unknown",
} = {}) {
  return (req, res, next) => {
    const nowMs = Date.now();
    cleanupExpired(nowMs);

    const key = keySelector(req);
    const entry = attempts.get(key);

    if (!entry || nowMs > entry.resetAt) {
      attempts.set(key, { count: 1, resetAt: nowMs + windowMs });
      return next();
    }

    if (entry.count >= maxAttempts) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - nowMs) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfterSeconds, 1)));
      return res.status(429).json({
        error: "Muitas tentativas. Tente novamente em instantes.",
      });
    }

    entry.count += 1;
    return next();
  };
}

module.exports = { createRateLimit };
