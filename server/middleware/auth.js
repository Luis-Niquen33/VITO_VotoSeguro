import jwt from "jsonwebtoken";

export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autorizado" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Sesión inválida o vencida, vuelve a iniciar sesión" });
  }
}

export function adminRequired(req, res, next) {
  if (req.user?.rol !== "admin") return res.status(403).json({ error: "Solo administradores" });
  next();
}
