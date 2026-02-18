require("dotenv").config();
const bcrypt = require("bcrypt");
const { db, pool } = require("../db/database");

async function main() {
  const name = process.argv[2];
  const cpf = process.argv[3];
  const password = process.argv[4];

  if (!name || !cpf || !password) {
    console.log('Uso: node src/scripts/createAdmin.js "Nome" "CPF" "SENHA"');
    process.exit(1);
  }

  const existResult = await db.query("SELECT id FROM users WHERE cpf = $1", [cpf]);
  if (existResult.rows[0]) {
    console.log("CPF ja cadastrado");
    process.exit(1);
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const insertResult = await db.query(
    "INSERT INTO users (name, cpf, password_hash, role) VALUES ($1, $2, $3, 'ADMIN') RETURNING id",
    [name, cpf, password_hash],
  );

  console.log("Admin criado com id:", Number(insertResult.rows[0].id));
}

main()
  .catch((err) => {
    console.error("Erro ao criar admin:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
