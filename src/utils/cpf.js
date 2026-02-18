function normalizeCpf(value) {
  if (!value) return "";
  return String(value).replace(/\D/g, "");
}

module.exports = { normalizeCpf };
