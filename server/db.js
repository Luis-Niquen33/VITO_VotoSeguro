import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Muchos proveedores de PostgreSQL en la nube (Render, Railway, Supabase)
  // requieren SSL. Si tu DATABASE_URL empieza con "postgres://" y el proveedor
  // lo exige, descomenta la siguiente línea:
  // ssl: { rejectUnauthorized: false },
});
