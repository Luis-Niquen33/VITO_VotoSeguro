const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getToken() {
  return localStorage.getItem("vs_token");
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = "Error de red";
    try {
      const data = await res.json();
      message = data.error || message;
    } catch (e) {
      // respuesta sin cuerpo JSON
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function login(usuario, clave) {
  const data = await request("/api/auth/login", { method: "POST", body: { usuario, clave }, auth: false });
  localStorage.setItem("vs_token", data.token);
  localStorage.setItem("vs_user", JSON.stringify(data.user));
  return data.user;
}

export function logout() {
  localStorage.removeItem("vs_token");
  localStorage.removeItem("vs_user");
}

export function getStoredUser() {
  const raw = localStorage.getItem("vs_user");
  return raw ? JSON.parse(raw) : null;
}

export const getRegistros = () => request("/api/registros");
export const addRegistroApi = (data) => request("/api/registros", { method: "POST", body: data });
export const deleteRegistroApi = (id) => request(`/api/registros/${id}`, { method: "DELETE" });

export const getUsuarios = () => request("/api/usuarios");
export const addUsuarioApi = (data) => request("/api/usuarios", { method: "POST", body: data });
export const deleteUsuarioApi = (id) => request(`/api/usuarios/${id}`, { method: "DELETE" });
