import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "./db.js";
import { authRequired, adminRequired } from "./middleware/auth.js";

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

const PORT = process.env.PORT || 4000;

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---------- AUTH ----------
app.post("/api/auth/login", async (req, res) => {
  const { usuario, clave } = req.body || {};
  if (!usuario || !clave) return res.status(400).json({ error: "Usuario y contraseña requeridos" });

  const { rows } = await pool.query("SELECT * FROM usuarios WHERE usuario = $1", [usuario]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

  const ok = await bcrypt.compare(clave, user.clave_hash);
  if (!ok) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

  const token = jwt.sign(
    { id: user.id, usuario: user.usuario, rol: user.rol, nombre: user.nombre },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
  res.json({ token, user: { id: user.id, usuario: user.usuario, rol: user.rol, nombre: user.nombre } });
});

// ---------- REGISTROS ----------
app.get("/api/registros", authRequired, async (req, res) => {
  const isAdmin = req.user.rol === "admin";
  const query = isAdmin
    ? `SELECT r.*, u.nombre AS promotor_nombre FROM registros r
       JOIN usuarios u ON u.id = r.promotor_id ORDER BY r.created_at DESC`
    : `SELECT r.*, u.nombre AS promotor_nombre FROM registros r
       JOIN usuarios u ON u.id = r.promotor_id WHERE r.promotor_id = $1 ORDER BY r.created_at DESC`;
  const { rows } = await pool.query(query, isAdmin ? [] : [req.user.id]);
  res.json(rows);
});

app.post("/api/registros", authRequired, async (req, res) => {
  const { nombre, edad, dni, zona } = req.body || {};
  if (!nombre || !edad) return res.status(400).json({ error: "Nombre y edad son obligatorios" });

  if (dni) {
    const dup = await pool.query("SELECT id FROM registros WHERE dni = $1", [dni]);
    if (dup.rows.length > 0) return res.status(409).json({ error: "Este DNI ya está registrado" });
  }

  const { rows } = await pool.query(
    `INSERT INTO registros (nombre, edad, dni, zona, promotor_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [nombre, edad, dni || null, zona?.trim() || "Sin zona/calle", req.user.id]
  );
  res.status(201).json({ ...rows[0], promotor_nombre: req.user.nombre });
});

app.delete("/api/registros/:id", authRequired, async (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.rol === "admin";
  const query = isAdmin
    ? "DELETE FROM registros WHERE id = $1"
    : "DELETE FROM registros WHERE id = $1 AND promotor_id = $2";
  await pool.query(query, isAdmin ? [id] : [id, req.user.id]);
  res.status(204).end();
});

// ---------- USUARIOS (solo admin) ----------
app.get("/api/usuarios", authRequired, adminRequired, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, usuario, rol, nombre, created_at FROM usuarios ORDER BY created_at ASC"
  );
  res.json(rows);
});

app.post("/api/usuarios", authRequired, adminRequired, async (req, res) => {
  const { usuario, clave, nombre } = req.body || {};
  if (!usuario || !clave || !nombre) {
    return res.status(400).json({ error: "Usuario, contraseña y nombre son obligatorios" });
  }
  const exists = await pool.query("SELECT id FROM usuarios WHERE usuario = $1", [usuario]);
  if (exists.rows.length > 0) return res.status(409).json({ error: "Ese usuario ya existe" });

  const hash = await bcrypt.hash(clave, 10);
  const { rows } = await pool.query(
    `INSERT INTO usuarios (usuario, clave_hash, rol, nombre)
     VALUES ($1, $2, 'promotor', $3) RETURNING id, usuario, rol, nombre, created_at`,
    [usuario, hash, nombre]
  );
  res.status(201).json(rows[0]);
});

app.delete("/api/usuarios/:id", authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ error: "No puedes eliminar tu propia cuenta mientras estás conectado con ella" });
  }
  await pool.query("DELETE FROM usuarios WHERE id = $1", [id]);
  res.status(204).end();
});

app.listen(PORT, () => console.log(`✓ API escuchando en http://localhost:${PORT}`));
