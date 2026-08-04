import { useState, useEffect, useMemo, useCallback } from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  getStoredUser,
  getRegistros,
  addRegistroApi,
  deleteRegistroApi,
  getUsuarios,
  addUsuarioApi,
  deleteUsuarioApi,
} from "./api.js";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');

* { box-sizing: border-box; }

.vs-grid { display: grid; grid-template-columns: minmax(280px, 340px) 1fr; gap: 24px; }
.vs-hero-number { font-size: 72px; }
.vs-hero-row { display: flex; align-items: baseline; gap: 18px; flex-wrap: wrap; }
.vs-user-form { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
.vs-user-form > div { flex: 1 1 150px; min-width: 130px; }
.vs-toolbar { display: flex; gap: 10px; flex-wrap: wrap; }
.vs-toolbar input { flex: 1 1 180px; }

@media (max-width: 720px) {
  .vs-grid { grid-template-columns: 1fr; }
  .vs-hero-number { font-size: 52px; }
  .vs-user-form > div { flex: 1 1 100%; }
}
`;

const INK = "#1C1414";
const PAPER = "#F7F1E9";
const RED_DARK = "#4E0C0C";
const RED = "#8C1414";
const RED_BRIGHT = "#C81E1E";
const GOLD = "#D9A441";
const TEAL = "#2F6B5E";
const RULE = "#D8C9B8";

// Real "palote" tally marks: groups of 5, the 5th stroke crossing the other 4.
function TallyGroup({ n, size = 22, color = INK }) {
  const strokes = Math.min(n, 5);
  return (
    <svg width={size * 1.6} height={size} viewBox="0 0 40 26" style={{ overflow: "visible" }}>
      {Array.from({ length: strokes }).map((_, i) => (
        <line key={i} x1={4 + i * 8} y1={2} x2={4 + i * 8} y2={24} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      ))}
      {n >= 5 && <line x1={0} y1={22} x2={36} y2={2} stroke={color} strokeWidth={2.5} strokeLinecap="round" />}
    </svg>
  );
}

function TallyRow({ count, color = INK, max = 60 }) {
  const shown = Math.min(count, max);
  const groups = Math.ceil(shown / 5) || (shown === 0 ? 0 : 1);
  const rest = count - shown;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      {Array.from({ length: groups }).map((_, i) => {
        const n = i === groups - 1 ? shown - i * 5 : 5;
        return <TallyGroup key={i} n={n} color={color} />;
      })}
      {rest > 0 && (
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color, opacity: 0.7 }}>+{rest} más</span>
      )}
      {count === 0 && (
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color, opacity: 0.5 }}>sin registros aún</span>
      )}
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [registros, setRegistros] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);

  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [query, setQuery] = useState("");
  const [nombre, setNombre] = useState("");
  const [edad, setEdad] = useState("");
  const [dni, setDni] = useState("");
  const [zona, setZona] = useState("");
  const [formMsg, setFormMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [nuevoUsuario, setNuevoUsuario] = useState("");
  const [nuevaClave, setNuevaClave] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [userMsg, setUserMsg] = useState("");

  const isAdmin = currentUser?.rol === "admin";

  const loadRegistros = useCallback(async (silent) => {
    if (!currentUser) return;
    if (!silent) setLoading(true);
    try {
      const data = await getRegistros();
      setRegistros(data);
    } catch (e) {
      if (e.status === 401) {
        apiLogout();
        setCurrentUser(null);
      }
    } finally {
      setLastSync(new Date());
      setLoading(false);
    }
  }, [currentUser]);

  const loadUsuarios = useCallback(async () => {
    if (!currentUser || currentUser.rol !== "admin") return;
    try {
      const data = await getUsuarios();
      setUsuarios(data);
    } catch (e) {
      // silencioso: se reintenta en el próximo ciclo
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    loadRegistros(false);
    loadUsuarios();
    const t = setInterval(() => {
      loadRegistros(true);
      loadUsuarios();
    }, 6000);
    return () => clearInterval(t);
  }, [currentUser, loadRegistros, loadUsuarios]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    try {
      const user = await apiLogin(loginUser.trim(), loginPass);
      setCurrentUser(user);
      setLoginUser("");
      setLoginPass("");
    } catch (err) {
      setLoginError(err.message || "Usuario o contraseña incorrectos.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    apiLogout();
    setCurrentUser(null);
    setRegistros([]);
    setUsuarios([]);
  };

  const addRegistro = async (e) => {
    e.preventDefault();
    setFormMsg("");
    if (!nombre.trim() || !edad.trim()) {
      setFormMsg("Nombre completo y edad son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      const nuevo = await addRegistroApi({
        nombre: nombre.trim(),
        edad: Number(edad),
        dni: dni.trim() || null,
        zona: zona.trim(),
      });
      setRegistros((prev) => [{ ...nuevo, promotor_nombre: currentUser.nombre }, ...prev]);
      setNombre("");
      setEdad("");
      setDni("");
      setZona("");
      setFormMsg("✓ Registrado correctamente.");
      setLastSync(new Date());
    } catch (err) {
      setFormMsg(err.message || "Error al guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const removeRegistro = async (id) => {
    try {
      await deleteRegistroApi(id);
      setRegistros((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setFormMsg("No se pudo eliminar el registro.");
    }
  };

  const addUsuario = async (e) => {
    e.preventDefault();
    setUserMsg("");
    if (!nuevoUsuario.trim() || !nuevaClave.trim() || !nuevoNombre.trim()) {
      setUserMsg("Completa usuario, contraseña y nombre del promotor.");
      return;
    }
    try {
      const nuevo = await addUsuarioApi({
        usuario: nuevoUsuario.trim(),
        clave: nuevaClave,
        nombre: nuevoNombre.trim(),
      });
      setUsuarios((prev) => [...prev, nuevo]);
      setNuevoUsuario("");
      setNuevaClave("");
      setNuevoNombre("");
      setUserMsg("✓ Promotor creado.");
    } catch (err) {
      setUserMsg(err.message || "No se pudo crear el usuario.");
    }
  };

  const deleteUsuario = async (id) => {
    try {
      await deleteUsuarioApi(id);
      setUsuarios((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setUserMsg(err.message || "No se pudo eliminar el usuario.");
    }
  };

  const zonas = useMemo(() => [...new Set(registros.map((r) => r.zona))], [registros]);

  const porZona = useMemo(() => {
    const m = {};
    registros.forEach((r) => (m[r.zona] = (m[r.zona] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [registros]);

  const porPromotor = useMemo(() => {
    const m = {};
    registros.forEach((r) => (m[r.promotor_nombre] = (m[r.promotor_nombre] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [registros]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registros;
    return registros.filter(
      (r) =>
        r.nombre.toLowerCase().includes(q) ||
        (r.dni || "").includes(q) ||
        r.zona.toLowerCase().includes(q) ||
        r.promotor_nombre.toLowerCase().includes(q)
    );
  }, [registros, query]);

  const exportCSV = () => {
    const header = "Nombre,Edad,Zona o calle,Promotor,DNI,Fecha\n";
    const rows = registros
      .map(
        (r) =>
          `"${r.nombre}","${r.edad}","${r.zona}","${r.promotor_nombre}","${r.dni || ""}","${new Date(
            r.created_at
          ).toLocaleString()}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voto-seguro-eten.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- LOGIN SCREEN ----------
  if (!currentUser) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${RED_DARK}, ${RED})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif", padding: 20 }}>
        <style>{FONTS}</style>
        <form onSubmit={handleLogin} style={{ background: PAPER, borderRadius: 12, padding: "34px 32px", width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: RED_BRIGHT, marginBottom: 4, textAlign: "center" }}>
            Etén
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 26, margin: "0 0 22px", textAlign: "center", color: INK }}>
            Conteo de Voto Seguro
          </h1>

          <label style={labelStyle}>Usuario</label>
          <input style={inputStyle} value={loginUser} onChange={(e) => setLoginUser(e.target.value)} placeholder="usuario" autoFocus />

          <label style={labelStyle}>Contraseña</label>
          <input style={inputStyle} type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} placeholder="contraseña" />

          <button type="submit" disabled={loggingIn} style={{ width: "100%", marginTop: 16, padding: "11px 0", borderRadius: 7, border: "none", background: RED_BRIGHT, color: "#fff", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
            {loggingIn ? "Ingresando…" : "Ingresar"}
          </button>
          {loginError && <div style={{ marginTop: 10, fontSize: 13, color: RED_BRIGHT, textAlign: "center" }}>{loginError}</div>}
          <div style={{ marginTop: 14, fontSize: 11.5, color: INK, opacity: 0.55, textAlign: "center", lineHeight: 1.5 }}>
            Primer ingreso (si acabas de correr la migración): usuario <b>admin</b>, contraseña la que hayas puesto en <code>ADMIN_DEFAULT_PASS</code>.
          </div>
        </form>
      </div>
    );
  }

  // ---------- DASHBOARD ----------
  return (
    <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'IBM Plex Sans', sans-serif", color: INK }}>
      <style>{FONTS}</style>

      {/* HERO */}
      <div style={{ background: `linear-gradient(180deg, ${RED_DARK}, ${RED})`, color: PAPER, padding: "30px 24px 40px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>
                Etén
              </div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 30, margin: 0 }}>
                Conteo de Voto Seguro
              </h1>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, opacity: 0.8 }}>
                {isAdmin ? "Administrador" : "Promotor"} · {currentUser.nombre}
              </div>
              <button onClick={handleLogout} type="button" style={{ marginTop: 6, border: `1px solid ${PAPER}`, background: "transparent", color: PAPER, borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
                Cerrar sesión
              </button>
            </div>
          </div>

          <div className="vs-hero-row" style={{ marginTop: 26 }}>
            <div className="vs-hero-number" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, lineHeight: 1 }}>
              {registros.length}
            </div>
            <div>
              <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 6 }}>
                {isAdmin ? "votos seguros registrados en total" : "votos seguros que tú registraste"}
              </div>
              <TallyRow count={registros.length} color={PAPER} />
            </div>
          </div>
        </div>
      </div>

      <div className="vs-grid" style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 24px 60px" }}>
        {/* FORM */}
        <form onSubmit={addRegistro} style={{ background: "#fff", border: `1px solid ${RULE}`, borderRadius: 10, padding: 22, alignSelf: "start" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18, marginBottom: 14 }}>
            Nueva ficha de registro
          </div>

          <label style={labelStyle}>Nombre completo</label>
          <input style={inputStyle} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. María Torres Ríos" />

          <label style={labelStyle}>Edad</label>
          <input style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }} value={edad} onChange={(e) => setEdad(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Ej. 34" inputMode="numeric" />

          <label style={labelStyle}>Zona o calle</label>
          <input style={inputStyle} list="zonas-list" value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Ej. Etén Centro / Calle Grau 210" />
          <datalist id="zonas-list">{zonas.map((z) => <option key={z} value={z} />)}</datalist>

          <label style={labelStyle}>Promotor responsable</label>
          <input style={{ ...inputStyle, background: "#F2ECE0", color: "#666" }} value={currentUser.nombre} disabled />

          <label style={labelStyle}>DNI (opcional)</label>
          <input style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }} value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))} placeholder="Ej. 12345678" inputMode="numeric" />

          <button type="submit" disabled={saving} style={{ width: "100%", marginTop: 16, padding: "11px 0", borderRadius: 7, border: "none", background: saving ? "#7A1010" : RED_BRIGHT, color: "#fff", fontWeight: 600, fontSize: 15, cursor: saving ? "default" : "pointer" }}>
            {saving ? "Guardando…" : "Registrar voto seguro"}
          </button>
          {formMsg && <div style={{ marginTop: 10, fontSize: 13, color: formMsg.startsWith("✓") ? TEAL : RED_BRIGHT }}>{formMsg}</div>}
        </form>

        {/* BREAKDOWN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#fff", border: `1px solid ${RULE}`, borderRadius: 10, padding: 20 }}>
            <div style={sectionTitle}>Por zona o calle {isAdmin ? "" : "(tus registros)"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
              {porZona.length === 0 && <span style={{ fontSize: 13, opacity: 0.55 }}>Aún no hay registros.</span>}
              {porZona.map(([z, n]) => (
                <div key={z} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: `1px dashed ${RULE}`, paddingBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, minWidth: 130 }}>{z}</span>
                  <TallyRow count={n} max={30} color={RED} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: RED }}>{n}</span>
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div style={{ background: "#fff", border: `1px solid ${RULE}`, borderRadius: 10, padding: 20 }}>
              <div style={sectionTitle}>Por promotor</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
                {porPromotor.length === 0 && <span style={{ fontSize: 13, opacity: 0.55 }}>Aún no hay registros.</span>}
                {porPromotor.map(([p, n]) => (
                  <div key={p} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: `1px dashed ${RULE}`, paddingBottom: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, minWidth: 130 }}>{p}</span>
                    <TallyRow count={n} max={30} color={TEAL} />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: TEAL }}>{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* LIST */}
        <div style={{ gridColumn: "1 / -1", background: "#fff", border: `1px solid ${RULE}`, borderRadius: 10, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <div style={sectionTitle}>{isAdmin ? "Todos los registros" : "Tus registros"} ({filtered.length})</div>
            <div className="vs-toolbar">
              <input style={{ ...inputStyle, marginBottom: 0 }} placeholder="Buscar por nombre, zona, calle, DNI…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button onClick={exportCSV} type="button" style={ghostBtn}>Exportar CSV</button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: RED, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  <th style={th}>Nombre</th>
                  <th style={th}>Edad</th>
                  <th style={th}>Zona o calle</th>
                  {isAdmin && <th style={th}>Promotor</th>}
                  <th style={th}>DNI</th>
                  <th style={th}>Fecha</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice()
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map((r) => (
                    <tr key={r.id} style={{ borderTop: `1px solid ${RULE}` }}>
                      <td style={td}>{r.nombre}</td>
                      <td style={{ ...td, fontFamily: "'IBM Plex Mono', monospace" }}>{r.edad}</td>
                      <td style={td}>{r.zona}</td>
                      {isAdmin && <td style={td}>{r.promotor_nombre}</td>}
                      <td style={{ ...td, fontFamily: "'IBM Plex Mono', monospace", opacity: r.dni ? 1 : 0.4 }}>{r.dni || "—"}</td>
                      <td style={{ ...td, opacity: 0.6 }}>{new Date(r.created_at).toLocaleDateString()}</td>
                      <td style={td}>
                        <button onClick={() => removeRegistro(r.id)} type="button" style={{ border: "none", background: "none", color: RED_BRIGHT, cursor: "pointer", fontSize: 12 }}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} style={{ ...td, textAlign: "center", opacity: 0.5, padding: "24px 0" }}>Sin resultados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* USER MANAGEMENT (admin only) */}
        {isAdmin && (
          <div style={{ gridColumn: "1 / -1", background: "#fff", border: `1px solid ${RULE}`, borderRadius: 10, padding: 20 }}>
            <div style={sectionTitle}>Cuentas de promotores</div>
            <form onSubmit={addUsuario} className="vs-user-form" style={{ marginTop: 14 }}>
              <div>
                <label style={labelStyle}>Nombre del promotor</label>
                <input style={inputStyle} value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Ej. Juan Pérez" />
              </div>
              <div>
                <label style={labelStyle}>Usuario</label>
                <input style={inputStyle} value={nuevoUsuario} onChange={(e) => setNuevoUsuario(e.target.value)} placeholder="usuario" />
              </div>
              <div>
                <label style={labelStyle}>Contraseña</label>
                <input style={inputStyle} value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} placeholder="contraseña" />
              </div>
              <button type="submit" style={{ padding: "10px 16px", borderRadius: 6, border: "none", background: RED_BRIGHT, color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: "pointer", flex: "1 1 100%" }}>
                Crear promotor
              </button>
            </form>
            {userMsg && <div style={{ marginTop: 8, fontSize: 13, color: userMsg.startsWith("✓") ? TEAL : RED_BRIGHT }}>{userMsg}</div>}

            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {usuarios.map((u) => (
                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5, borderTop: `1px solid ${RULE}`, paddingTop: 8 }}>
                  <span>
                    <b>{u.nombre}</b> — usuario: <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{u.usuario}</span> ({u.rol})
                  </span>
                  {u.id !== currentUser.id && (
                    <button onClick={() => deleteUsuario(u.id)} type="button" style={{ border: "none", background: "none", color: RED_BRIGHT, cursor: "pointer", fontSize: 12 }}>
                      Eliminar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12.5, fontWeight: 600, color: RED, marginTop: 12, marginBottom: 5 };
const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 6,
  border: `1px solid ${RULE}`, fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif", marginBottom: 2,
};
const sectionTitle = { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17 };
const th = { padding: "6px 10px 10px" };
const td = { padding: "10px" };
const ghostBtn = {
  border: `1px solid ${RED}`, background: "transparent", color: RED, borderRadius: 6,
  padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500,
};
