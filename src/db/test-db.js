const { pool } = require("./database");

(async () => {
  try {
    const res = await pool.query("SELECT NOW() AS now");
    console.log("Conectado:", res.rows[0]);
  } catch (err) {
    console.error("Erro na conexão:", err.message);
  } finally {
    await pool.end();
  }
})();
