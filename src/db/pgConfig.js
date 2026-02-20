const path = require("path");
const dotenv = require("dotenv");

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: false });

function parseBoolean(value, defaultValue) {
  if (value == null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function getSslConfig() {
  const hasCaCert = Boolean(process.env.DB_CA_CERT);
  const sslEnabled = parseBoolean(process.env.DB_SSL, false) || hasCaCert;

  if (!sslEnabled) return false;

  const sslConfig = {
    rejectUnauthorized: parseBoolean(
      process.env.DB_SSL_REJECT_UNAUTHORIZED,
      true,
    ),
  };

  if (hasCaCert) {
    sslConfig.ca = process.env.DB_CA_CERT.replace(/\\n/g, "\n");
  }

  return sslConfig;
}

function getPgConnectionConfig() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  return {
    connectionString,
    ssl: getSslConfig(),
  };
}

module.exports = { getPgConnectionConfig };
