const jwt = require("jsonwebtoken");

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required");
}

const jwtIssuer = process.env.JWT_ISSUER || "sistema-ponto-backend";
const jwtAudience = process.env.JWT_AUDIENCE || "sistema-ponto-app";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "8h";

function signToken(payload) {
  return jwt.sign(payload, jwtSecret, {
    expiresIn: jwtExpiresIn,
    issuer: jwtIssuer,
    audience: jwtAudience,
    algorithm: "HS256",
    subject: String(payload.id),
  });
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret, {
    issuer: jwtIssuer,
    audience: jwtAudience,
    algorithms: ["HS256"],
  });
}

module.exports = { signToken, verifyToken };
