import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { pool } from "./db.js";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("✓ Esquema aplicado correctamente.");

  const adminUser = process.env.ADMIN_DEFAULT_USER || "admin";
  const { rows } = await pool.query("SELECT id FROM usuarios WHERE usuario = $1", [adminUser]);

  if (rows.length === 0) {
    const pass = process.env.ADMIN_DEFAULT_PASS || "VotoSeguro2026";
    const nombre = process.env.ADMIN_DEFAULT_NAME || "Administrador";
    const hash = await bcrypt.hash(pass, 10);
    await pool.query(
      "INSERT INTO usuarios (usuario, clave_hash, rol, nombre) VALUES ($1, $2, 'admin', $3)",
      [adminUser, hash, nombre]
    );
    console.log(`✓ Administrador por defecto creado -> usuario: "${adminUser}" / contraseña: "${pass}"`);
    console.log("  Cámbiala apenas entres (crea otro admin y elimina este).");
  } else {
    console.log("✓ Ya existe al menos un administrador, no se creó uno nuevo.");
  }

  await pool.end();
}

migrate().catch((err) => {
  console.error("✗ Error al migrar:", err.message);
  process.exit(1);
});
