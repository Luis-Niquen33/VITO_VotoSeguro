import { useState, useEffect, useMemo, useCallback } from "react";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
`;

const INK = "#1C1414";
const PAPER = "#F7F1E9";
const RED_DARK = "#4E0C0C";
const RED = "#8C1414";
const RED_BRIGHT = "#C81E1E";
const GOLD = "#D9A441";
const TEAL = "#2F6B5E";
const RULE = "#D8C9B8";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

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

const DEFAULT_ADMIN = { id: "admin-1", usuario: "admin", clave: "VotoSeguro2026", rol: "admin", nombre: "Administrador" };

export default function ConteoVotoSeguro() {
  const [registros, setRegistros] = useState([]);
  const [usuarios, setUsuarios] = useState(null); // null = aún no cargado
  const [currentUser, setCurrentUser] = useState(null);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [query, setQuery] = useState("");
  const [nombre, setNombre] = useState("");
  const [edad, setEdad] = useState("");
  const [dni, setDni] = useState("");
  const [zona, setZona] = useState("");
  const [formMsg, setFormMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Panel de gestión de usuarios (admin)
  const [nuevoUsuario, setNuevoUsuario] = useState("");
  const [nuevaClave, setNuevaClave] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [userMsg, setUserMsg] = useState("");

  const loadRegistros = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const res = await window.storage.get("registros", true);
      const parsed = res && res.value ? JSON.parse(res.value) : [];
      setRegistros(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      setRegistros([]);
    } finally {
      setLastSync(new Date());
      setLoading(false);
    }
  }, []);

  const loadUsuarios = useCallback(async () => {
    try {
      const res = await window.storage.get("usuarios", true);
      const parsed = res && res.value ? JSON.parse(res.value) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        setUsuarios(parsed);
      } else {
        await window.storage.set("usuarios", JSON.stringify([DEFAULT_ADMIN]), true);
        setUsuarios([DEFAULT_ADMIN]);
      }
    } catch (e) {
      try {
        await window.storage.set("usuarios", JSON.stringify([DEFAULT_ADMIN]), true);
        setUsuarios([DEFAULT_ADMIN]);
      } catch (e2) {
        setUsuarios([DEFAULT_ADMIN]);
      }
    }
  }, []);

  useEffect(() => {
    loadRegistros(false);
    loadUsuarios();
    const t = setInterval(() => loadRegistros(true), 6000);
    return () => clearInterval(t);
  }, [loadRegistros, loadUsuarios]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const fresh = await window.storage.get("usuarios", true).catch(() => null);
      const list = fresh && fresh.value ? JSON.parse(fresh.value) : usuarios || [DEFAULT_ADMIN];
      const match = list.find((u) => u.usuario === loginUser.trim() && u.clave === loginPass);
      if (!match) {
        setLoginError("Usuario o contraseña incorrectos.");
        return;
      }
      setUsuarios(list);
      setCurrentUser(match);
      setLoginUser("");
      setLoginPass("");
    } catch (err) {
      setLoginError("No se pudo verificar el acceso. Intenta de nuevo.");
    }
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
      const fresh = await window.storage.get("registros", true).catch(() => null);
      const current = fresh && fresh.value ? JSON.parse(fresh.value) : registros;
      const dniClean = dni.trim();
      if (dniClean && current.some((r) => r.dni === dniClean)) {
        setFormMsg("Este DNI ya está registrado. No se agregó un duplicado.");
        setSaving(false);
        return;
      }
      const promotorAsignado = currentUser.rol === "promotor" ? currentUser.nombre : (zona ? currentUser.nombre : currentUser.nombre);
      const nuevo = {
        id: uid(),
        nombre: nombre.trim(),
        edad: edad.trim(),
        dni: dniClean,
        zona: zona.trim() || "Sin zona/calle",
        promotor: currentUser.rol === "promotor" ? currentUser.nombre : (currentUser.nombre || "Administrador"),
        ts: Date.now(),
      };
      const updated = [...current, nuevo];
      const result = await window.storage.set("registros", JSON.stringify(updated), true);
      if (!result) throw new Error("No se pudo guardar");
      setRegistros(updated);
      setNombre("");
      setEdad("");
      setDni("");
      setZona("");
      setFormMsg("✓ Registrado correctamente.");
      setLastSync(new Date());
    } catch (err) {
      setFormMsg("Error al guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const removeRegistro = async (id) => {
    try {
      const fresh = await window.storage.get("registros", true).catch(() => null);
      const current = fresh && fresh.value ? JSON.parse(fresh.value) : registros;
      const updated = current.filter((r) => r.id !== id);
      await window.storage.set("registros", JSON.stringify(updated), true);
      setRegistros(updated);
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
      const fresh = await window.storage.get("usuarios", true).catch(() => null);
      const current = fresh && fresh.value ? JSON.parse(fresh.value) : usuarios || [DEFAULT_ADMIN];
      if (current.some((u) => u.usuario === nuevoUsuario.trim())) {
        setUserMsg("Ese usuario ya existe.");
        return;
      }
      const nuevo = { id: uid(), usuario: nuevoUsuario.trim(), clave: nuevaClave, rol: "promotor", nombre: nuevoNombre.trim() };
      const updated = [...current, nuevo];
      await window.storage.set("usuarios", JSON.stringify(updated), true);
      setUsuarios(updated);
      setNuevoUsuario("");
      setNuevaClave("");
      setNuevoNombre("");
      setUserMsg("✓ Promotor creado.");
    } catch (err) {
      setUserMsg("No se pudo crear el usuario.");
    }
  };

  const deleteUsuario = async (id) => {
    try {
      const fresh = await window.storage.get("usuarios", true).catch(() => null);
      const current = fresh && fresh.value ? JSON.parse(fresh.value) : usuarios || [];
      const updated = current.filter((u) => u.id !== id);
      await window.storage.set("usuarios", JSON.stringify(updated), true);
      setUsuarios(updated);
    } catch (e) {
      setUserMsg("No se pudo eliminar el usuario.");
    }
  };

  const registrosVisibles = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.rol === "admin") return registros;
    return registros.filter((r) => r.promotor === currentUser.nombre);
  }, [registros, currentUser]);

  const zonas = useMemo(() => [...new Set(registrosVisibles.map((r) => r.zona))], [registrosVisibles]);

  const porZona = useMemo(() => {
    const m = {};
    registrosVisibles.forEach((r) => (m[r.zona] = (m[r.zona] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [registrosVisibles]);

  const porPromotor = useMemo(() => {
    const m = {};
    registros.forEach((r) => (m[r.promotor] = (m[r.promotor] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [registros]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registrosVisibles;
    return registrosVisibles.filter(
      (r) =>
        r.nombre.toLowerCase().includes(q) ||
        (r.dni || "").includes(q) ||
        r.zona.toLowerCase().includes(q) ||
        r.promotor.toLowerCase().includes(q)
    );
  }, [registrosVisibles, query]);

  const exportCSV = () => {
    const header = "Nombre,Edad,Zona o calle,Promotor,DNI,Fecha\n";
    const rows = registrosVisibles
      .map((r) => `"${r.nombre}","${r.edad}","${r.zona}","${r.promotor}","${r.dni || ""}","${new Date(r.ts).toLocaleString()}"`)
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
      <div className="vs-shell--login">
        <style>{FONTS}</style>
        <form onSubmit={handleLogin} className="vs-login-card">
          <div className="vs-brand">ET</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: RED_BRIGHT, marginBottom: 4, textAlign: "center" }}>
            Etén
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 26, margin: "0 0 22px", textAlign: "center", color: INK }}>
            Conteo de Voto Seguro
          </h1>

          <label style={labelStyle}>Usuario</label>
          <input className="vs-input" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} placeholder="usuario" autoFocus />

          <label style={labelStyle}>Contraseña</label>
          <input className="vs-input" type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} placeholder="contraseña" />

          <button className="vs-btn vs-btn--primary" type="submit" style={{ width: "100%", marginTop: 16 }}>
            Ingresar
          </button>
          {loginError && <div style={{ marginTop: 10, fontSize: 13, color: RED_BRIGHT, textAlign: "center" }}>{loginError}</div>}
          {usuarios && usuarios.length === 1 && usuarios[0].id === "admin-1" && (
            <div style={{ marginTop: 14, fontSize: 11.5, color: INK, opacity: 0.6, textAlign: "center", lineHeight: 1.5 }}>
              Primer ingreso: usuario <b>admin</b>, contraseña <b>VotoSeguro2026</b>. Cámbiala luego creando otro usuario y eliminando este.
            </div>
          )}
        </form>
      </div>
    );
  }

  const isAdmin = currentUser.rol === "admin";

  // ---------- DASHBOARD ----------
  return (
    <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'IBM Plex Sans', sans-serif", color: INK }}>
      <style>{FONTS}</style>

      {/* HERO */}
      <div className="vs-hero">
        <div className="vs-hero-inner">
          <div className="vs-hero-top">
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>
                Etén
              </div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 30, margin: 0 }}>
                Conteo de Voto Seguro
              </h1>
              <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9, maxWidth: 560 }}>
                Registro rápido para promotores, resumen por zona y exportación sencilla para el cierre de jornada.
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, opacity: 0.8 }}>
                {isAdmin ? "Administrador" : "Promotor"} · {currentUser.nombre}
              </div>
              <button
                onClick={() => setCurrentUser(null)}
                type="button"
                className="vs-btn vs-btn--secondary"
                style={{ marginTop: 8 }}
              >
                Cerrar sesión
              </button>
            </div>
          </div>

          <div className="vs-hero-stats">
            <div className="vs-stat-card">
              <div className="vs-stat-label">Votos visibles</div>
              <strong>{registrosVisibles.length}</strong>
            </div>
            <div className="vs-stat-card">
              <div className="vs-stat-label">Zonas registradas</div>
              <strong>{zonas.length}</strong>
            </div>
            <div className="vs-stat-card">
              <div className="vs-stat-label">Última sincronización</div>
              <strong>{lastSync ? lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="vs-grid" style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 24px 60px", display: "grid", gridTemplateColumns: "minmax(280px, 340px) 1fr", gap: 24 }}>
        {/* FORM */}
        <form onSubmit={addRegistro} className="vs-panel" style={{ alignSelf: "start" }}>
          <div className="vs-section-title" style={{ marginBottom: 14 }}>
            Nueva ficha de registro
          </div>

          <label style={labelStyle}>Nombre completo</label>
          <input className="vs-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. María Torres Ríos" />

          <label style={labelStyle}>Edad</label>
          <input className="vs-input" style={{ fontFamily: "'IBM Plex Mono', monospace" }} value={edad} onChange={(e) => setEdad(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Ej. 34" inputMode="numeric" />

          <label style={labelStyle}>Zona o calle</label>
          <input className="vs-input" list="zonas-list" value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Ej. Etén Centro / Calle Grau 210" />
          <datalist id="zonas-list">{zonas.map((z) => <option key={z} value={z} />)}</datalist>

          <label style={labelStyle}>Promotor responsable</label>
          <input className="vs-input" style={{ background: "#F2ECE0", color: "#666" }} value={currentUser.nombre} disabled />

          <label style={labelStyle}>DNI (opcional)</label>
          <input className="vs-input" style={{ fontFamily: "'IBM Plex Mono', monospace" }} value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))} placeholder="Ej. 12345678" inputMode="numeric" />

          <button className="vs-btn vs-btn--primary" type="submit" disabled={saving} style={{ width: "100%", marginTop: 16, opacity: saving ? 0.85 : 1 }}>
            {saving ? "Guardando…" : "Registrar voto seguro"}
          </button>
          {formMsg && <div style={{ marginTop: 10, fontSize: 13, color: formMsg.startsWith("✓") ? TEAL : RED_BRIGHT }}>{formMsg}</div>}
        </form>

        {/* BREAKDOWN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="vs-panel">
            <div className="vs-section-title">Por zona o calle {isAdmin ? "" : "(tus registros)"}</div>
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
            <div className="vs-panel">
              <div className="vs-section-title">Por promotor</div>
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
        <div className="vs-panel vs-panel--wide">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <div className="vs-section-title">{isAdmin ? "Todos los registros" : "Tus registros"} ({filtered.length})</div>
            <div className="vs-toolbar">
              <input className="vs-input" style={{ marginBottom: 0 }} placeholder="Buscar por nombre, zona, calle, DNI…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button onClick={exportCSV} type="button" className="vs-btn vs-btn--ghost">Exportar CSV</button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="vs-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Edad</th>
                  <th>Zona o calle</th>
                  {isAdmin && <th>Promotor</th>}
                  <th>DNI</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice().sort((a, b) => b.ts - a.ts).map((r) => (
                  <tr key={r.id}>
                    <td>{r.nombre}</td>
                    <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{r.edad}</td>
                    <td>{r.zona}</td>
                    {isAdmin && <td>{r.promotor}</td>}
                    <td style={{ fontFamily: "'IBM Plex Mono', monospace", opacity: r.dni ? 1 : 0.4 }}>{r.dni || "—"}</td>
                    <td style={{ opacity: 0.6 }}>{new Date(r.ts).toLocaleDateString()}</td>
                    <td>
                      <button onClick={() => removeRegistro(r.id)} type="button" style={{ border: "none", background: "none", color: RED_BRIGHT, cursor: "pointer", fontSize: 12 }}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} style={{ textAlign: "center", opacity: 0.5, padding: "24px 0" }}>Sin resultados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* USER MANAGEMENT (admin only) */}
        {isAdmin && (
          <div className="vs-panel vs-panel--wide">
            <div className="vs-section-title">Cuentas de promotores</div>
            <form onSubmit={addUsuario} style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 150px", minWidth: 130 }}>
                <label style={labelStyle}>Nombre del promotor</label>
                <input className="vs-input" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Ej. Juan Pérez" />
              </div>
              <div style={{ flex: "1 1 150px", minWidth: 130 }}>
                <label style={labelStyle}>Usuario</label>
                <input className="vs-input" value={nuevoUsuario} onChange={(e) => setNuevoUsuario(e.target.value)} placeholder="usuario" />
              </div>
              <div style={{ flex: "1 1 150px", minWidth: 130 }}>
                <label style={labelStyle}>Contraseña</label>
                <input className="vs-input" value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} placeholder="contraseña" />
              </div>
              <button className="vs-btn vs-btn--primary" type="submit" style={{ flex: "1 1 100%" }}>
                Crear promotor
              </button>
            </form>
            {userMsg && <div style={{ marginTop: 8, fontSize: 13, color: userMsg.startsWith("✓") ? TEAL : RED_BRIGHT }}>{userMsg}</div>}

            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {(usuarios || []).map((u) => (
                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5, borderTop: `1px solid ${RULE}`, paddingTop: 8 }}>
                  <span>
                    <b>{u.nombre}</b> — usuario: <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{u.usuario}</span> ({u.rol})
                  </span>
                  {u.id !== "admin-1" && (
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
