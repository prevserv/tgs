require("dotenv").config();
const bcrypt = require("bcrypt");
const { db } = require("../db/database");

const name = process.argv[2];
const cpf = process.argv[3];
const password = process.argv[4];

if (!name || !cpf || !password) {
  console.log('Uso: node src/script/createAdmin.js "Nome" "CPF" "SENHA"');
  process.exit(1);
}

const exist = db.prepare("SELECT id FROM users WHERE cpf = ?").get(cpf);
if (exist) {
  console.log("CPF já cadastrado");
  process.exit(1);
}

const password_hash = bcrypt.hashSync(password, 10);

const stmt = db.prepare(
  "INSERT INTO users (name, cpf, password_hash, role) VALUES (?, ?, ?, 'ADMIN')",
);

const info = stmt.run(name, cpf, password_hash);

console.log("Admin criado com id:", Number(info.lastInsertRowid));
