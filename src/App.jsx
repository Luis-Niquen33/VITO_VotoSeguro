import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query as firestoreQuery, orderBy, onSnapshot, getDocs, setDoc, deleteDoc, doc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

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
const TOTAL_MESAS = 34;

const PARTIDOS = [
  { id: "renovacion-popular", nombre: "Renovación Popular", sigla: "RP", color: "#D33A32", logoUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Renovaci%C3%B3n%20Popular%20logo.svg?width=96" },
  { id: "fuerza-popular", nombre: "Fuerza Popular", sigla: "FP", color: "#F0A323", logoUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Fuerza%20Popular%20logo.svg?width=96" },
  { id: "avanza-pais", nombre: "Avanza País", sigla: "AP", color: "#1769A8", logoUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Avanza%20Pa%C3%ADs%20Logo%202017-20.jpg?width=96" },
  { id: "pais-para-todos", nombre: "País para Todos", sigla: "PPT", color: "#2F8B67", logoUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Pa%C3%ADs%20para%20Todos%20logo.svg?width=96" },
  { id: "somos-peru", nombre: "Somos Perú", sigla: "SP", color: "#6A4AA1", logoUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Somos%20Per%C3%BA%20logo.svg?width=96" },
  { id: "partido-aprista-peruano", nombre: "Partido Aprista Peruano", sigla: "PAP", color: "#B5282D", logoUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/APRA%20logo.svg?width=96" },
];

function emptyVotos() {
  return Object.fromEntries(PARTIDOS.map(({ id }) => [id, ""]));
}

function totalConteo(conteo) {
  return PARTIDOS.reduce((total, { id }) => total + (Number(conteo.votos?.[id]) || 0), 0) + (Number(conteo.blancos) || 0) + (Number(conteo.nulos) || 0) + (Number(conteo.impugnados) || 0);
}

function uid() {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  }
  throw new Error("Crypto API is required for UID generation");
}

function ProgressBar({ count, max, color = RED }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#EEE3D3", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s ease" }} />
    </div>
  );
}

function PartidoLogo({ partido, size = 48 }) {
  return (
    <div
      aria-label={`Logo de ${partido.nombre}`}
      title={partido.nombre}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        background: partido.color,
        color: "#fff",
        border: "4px solid #fff",
        boxShadow: `0 0 0 2px ${partido.color}33`,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: size < 48 ? 10 : 12,
        fontWeight: 700,
        letterSpacing: 0.2,
      }}
    >
      {partido.logoUrl && (
        <img
          src={partido.logoUrl}
          alt=""
          onError={(event) => { event.currentTarget.style.display = "none"; }}
          style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%", background: "#fff" }}
        />
      )}
      {partido.sigla}
    </div>
  );
}

function GoalRing({ value, min = 2500, max = 3000, size = 92 }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const reached = value >= min;
  const color = reached ? TEAL : GOLD;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
        <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fill="#fff" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, fontWeight: 700 }}>
          {value}
        </text>
        <text x="50%" y="65%" textAnchor="middle" dominantBaseline="middle" fill="#fff" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, opacity: 0.85 }}>
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase", color: reached ? "#8FE0C8" : "#fff", opacity: 0.9, textAlign: "center" }}>
        Meta mínima {min.toLocaleString()} a {max.toLocaleString()}
      </div>
    </div>
  );
}

const DEFAULT_ADMIN = { id: "admin-1", usuario: "admin", clave: "VotoSeguro2026", rol: "admin", nombre: "Administrador" };

function normalizeText(value) {
  return value
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .toLowerCase();
}

function isPotentialDuplicate(newEntry, existing) {
  const nameA = normalizeText(newEntry.nombre);
  const nameB = normalizeText(existing.nombre);
  const zoneA = normalizeText(newEntry.zona);
  const zoneB = normalizeText(existing.zona);
  const ageA = newEntry.edad.toString().trim();
  const ageB = existing.edad.toString().trim();
  const dniA = newEntry.dni.toString().trim();
  const dniB = existing.dni.toString().trim();

  if (dniA && dniB && dniA === dniB) {
    return { type: "dni", message: "Existe un registro con el mismo DNI." };
  }

  const sameName = nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA);
  const sameAge = ageA && ageA === ageB;
  const sameZone = zoneA && zoneA === zoneB;
  const similarName = nameA.startsWith(nameB) || nameB.startsWith(nameA) || nameA.split(" ").some((part) => part && nameB.includes(part));

  if (sameName && (sameAge || sameZone)) {
    return { type: "similar", message: "Existe un registro similar con mismo nombre y edad o zona." };
  }
  if (similarName && sameAge && sameZone) {
    return { type: "similar", message: "El registro parece coincidir con uno existente (nombre similar, edad y zona iguales)." };
  }
  if (sameName && ageA === ageB) {
    return { type: "similar", message: "El nombre y la edad son iguales a un registro existente." };
  }

  return null;
}

export default function ConteoVotoSeguro() {
  const [registros, setRegistros] = useState([]);
  const [conteosMesas, setConteosMesas] = useState([]);
  const [usuarios, setUsuarios] = useState([DEFAULT_ADMIN]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [filterPromotor, setFilterPromotor] = useState("");
  const [filterZona, setFilterZona] = useState("");
  const [nombre, setNombre] = useState("");
  const [edad, setEdad] = useState("");
  const [dni, setDni] = useState("");
  const [zona, setZona] = useState("");
  const [formMsg, setFormMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: "", edad: "", dni: "", zona: "" });
  const [mesa, setMesa] = useState("");
  const [localMesa, setLocalMesa] = useState("");
  const [electoresMesa, setElectoresMesa] = useState("");
  const [votosMesa, setVotosMesa] = useState(emptyVotos);
  const [blancosMesa, setBlancosMesa] = useState("");
  const [nulosMesa, setNulosMesa] = useState("");
  const [impugnadosMesa, setImpugnadosMesa] = useState("");
  const [mesaMsg, setMesaMsg] = useState("");
  const [savingMesa, setSavingMesa] = useState(false);

  // Panel de gestión de usuarios (admin)
  const [nuevoUsuario, setNuevoUsuario] = useState("");
  const [nuevaClave, setNuevaClave] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoRol, setNuevoRol] = useState("promotor");
  const [userMsg, setUserMsg] = useState("");

  const registrosCollection = db ? collection(db, "registros") : null;
  const usuariosCollection = db ? collection(db, "usuarios") : null;
  const conteosMesasCollection = db ? collection(db, "conteo_mesas") : null;

  const loadRegistros = useCallback(async (silent) => {
    if (isFirebaseConfigured) return;
    try {
      const res = await window.storage.get("registros", true);
      const parsed = res?.value ? JSON.parse(res.value) : [];
      setRegistros(Array.isArray(parsed) ? parsed : []);
    } catch (error_) {
      console.warn("Error loading registros:", error_);
      setRegistros([]);
    } finally {
      setLastSync(new Date());
    }
  }, [isFirebaseConfigured]);

  const loadUsuarios = useCallback(async () => {
    if (isFirebaseConfigured) return;
    try {
      const res = await window.storage.get("usuarios", true);
      const parsed = res?.value ? JSON.parse(res.value) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        setUsuarios(parsed);
      } else {
        await window.storage.set("usuarios", JSON.stringify([DEFAULT_ADMIN]), true);
        setUsuarios([DEFAULT_ADMIN]);
      }
    } catch (error_) {
      console.warn("Error loading usuarios:", error_);
      try {
        await window.storage.set("usuarios", JSON.stringify([DEFAULT_ADMIN]), true);
        setUsuarios([DEFAULT_ADMIN]);
      } catch (error__) {
        console.warn("Error writing default admin:", error__);
        setUsuarios([DEFAULT_ADMIN]);
      }
    }
  }, [isFirebaseConfigured]);

  const loadConteosMesas = useCallback(async () => {
    if (isFirebaseConfigured || currentUser?.rol !== "admin") return;
    try {
      const res = await window.storage.get("conteo_mesas", true);
      const parsed = res?.value ? JSON.parse(res.value) : [];
      setConteosMesas(Array.isArray(parsed) ? parsed : []);
    } catch (error_) {
      console.warn("Error loading conteos por mesa:", error_);
      setConteosMesas([]);
    }
  }, [currentUser, isFirebaseConfigured]);

  useEffect(() => {
    if (!currentUser) return;

    if (!isFirebaseConfigured) {
      loadRegistros(false);
      loadUsuarios();
      if (currentUser.rol === "admin") loadConteosMesas();
      const t = setInterval(() => {
        loadRegistros(true);
        if (currentUser.rol === "admin") loadConteosMesas();
      }, 6000);
      return () => clearInterval(t);
    }

    if (!registrosCollection || !usuariosCollection) return;

    const registrosQuery = firestoreQuery(registrosCollection, orderBy("ts", "desc"));
    const usuariosQuery = firestoreQuery(usuariosCollection, orderBy("nombre"));

    const unsubscribeRegistros = onSnapshot(
      registrosQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setRegistros(items);
        setLastSync(new Date());
      },
      (error) => {
        console.error("Firestore registros snapshot error:", error);
      }
    );

    const unsubscribeUsuarios = onSnapshot(
      usuariosQuery,
      async (snapshot) => {
        if (snapshot.empty) {
          await setDoc(doc(usuariosCollection, DEFAULT_ADMIN.id), DEFAULT_ADMIN);
          setUsuarios([DEFAULT_ADMIN]);
          return;
        }
        const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setUsuarios(items);
      },
      (error) => {
        console.error("Firestore usuarios snapshot error:", error);
        setUsuarios((current) => (current?.length ? current : [DEFAULT_ADMIN]));
      }
    );

    let unsubscribeConteosMesas = () => {};
    if (currentUser.rol === "admin" && conteosMesasCollection) {
      const conteosMesasQuery = firestoreQuery(conteosMesasCollection, orderBy("ts", "desc"));
      unsubscribeConteosMesas = onSnapshot(
        conteosMesasQuery,
        (snapshot) => setConteosMesas(snapshot.docs.map((doc_) => ({ id: doc_.id, ...doc_.data() }))),
        (error) => console.error("Firestore conteo_mesas snapshot error:", error)
      );
    } else {
      setConteosMesas([]);
    }

    return () => {
      unsubscribeRegistros();
      unsubscribeUsuarios();
      unsubscribeConteosMesas();
    };
  }, [currentUser, isFirebaseConfigured, loadRegistros, loadUsuarios, loadConteosMesas, registrosCollection, usuariosCollection, conteosMesasCollection]);

  const refreshNow = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (isFirebaseConfigured && registrosCollection && usuariosCollection) {
        const registrosQuery = firestoreQuery(registrosCollection, orderBy("ts", "desc"));
        const usuariosQuery = firestoreQuery(usuariosCollection, orderBy("nombre"));
        const [registrosSnap, usuariosSnap] = await Promise.all([getDocs(registrosQuery), getDocs(usuariosQuery)]);
        setRegistros(registrosSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        if (currentUser.rol === "admin" && conteosMesasCollection) {
          const conteosMesasQuery = firestoreQuery(conteosMesasCollection, orderBy("ts", "desc"));
          const conteosMesasSnap = await getDocs(conteosMesasQuery);
          setConteosMesas(conteosMesasSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
        if (!usuariosSnap.empty) {
          setUsuarios(usuariosSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } else {
        await Promise.all([loadRegistros(true), loadUsuarios(), currentUser.rol === "admin" ? loadConteosMesas() : Promise.resolve()]);
      }
      setLastSync(new Date());
    } catch (error_) {
      console.error("Manual refresh error:", error_);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, currentUser, isFirebaseConfigured, registrosCollection, usuariosCollection, conteosMesasCollection, loadRegistros, loadUsuarios, loadConteosMesas]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      let list = usuarios || [DEFAULT_ADMIN];
      if (isFirebaseConfigured) {
        // The seeded admin keeps login available while Firestore reconnects.
      } else {
        const fresh = await window.storage.get("usuarios", true).catch(() => null);
        list = fresh?.value ? JSON.parse(fresh.value) : usuarios || [DEFAULT_ADMIN];
      }
      const match = list.find((u) => u.usuario === loginUser.trim() && u.clave === loginPass);
      if (!match) {
        setLoginError("Usuario o contraseña incorrectos.");
        return;
      }
      setUsuarios(list);
      setActiveView("dashboard");
      setCurrentUser(match);
      setLoginUser("");
      setLoginPass("");
    } catch (error_) {
      console.error("Login error:", error_);
      setLoginError("No se pudo verificar el acceso. Intenta de nuevo.");
    }
  };

  const addRegistro = async (e) => {
    e.preventDefault();
    setFormMsg("");
    if (!nombre.trim()) {
      setFormMsg("Nombre completo es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const current = isFirebaseConfigured
        ? registros
        : await window.storage
            .get("registros", true)
            .then((res) => (res?.value ? JSON.parse(res.value) : registros))
            .catch(() => registros);
      const dniClean = dni.trim();
      const nuevo = {
        id: uid(),
        nombre: nombre.trim(),
        edad: edad.trim(),
        dni: dniClean,
        zona: zona.trim() || "Sin zona/calle",
        promotor: currentUser.rol === "promotor" ? currentUser.nombre : (currentUser.nombre || "Administrador"),
        ts: Date.now(),
      };
      const duplicate = current.find((r) => isPotentialDuplicate(nuevo, r));
      if (duplicate) {
        const warning = isPotentialDuplicate(nuevo, duplicate);
        setFormMsg(warning?.message || "Posible duplicado detectado. Verifica antes de continuar.");
        setSaving(false);
        return;
      }
      if (dniClean && current.some((r) => r.dni === dniClean)) {
        setFormMsg("Este DNI ya está registrado. No se agregó un duplicado.");
        setSaving(false);
        return;
      }
      const updated = [...current, nuevo];
      if (isFirebaseConfigured) {
        await setDoc(doc(registrosCollection, nuevo.id), nuevo);
        setRegistros(updated);
      } else {
        const result = await window.storage.set("registros", JSON.stringify(updated), true);
        if (!result) throw new Error("No se pudo guardar");
        setRegistros(updated);
      }
      setNombre("");
      setEdad("");
      setDni("");
      setZona("");
      setFormMsg("✓ Registrado correctamente.");
      setLastSync(new Date());
    } catch (err) {
      console.error("Save registro error:", err);
      setFormMsg("Error al guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const resetMesaForm = () => {
    setMesa("");
    setLocalMesa("");
    setElectoresMesa("");
    setVotosMesa(emptyVotos());
    setBlancosMesa("");
    setNulosMesa("");
    setImpugnadosMesa("");
  };

  const saveConteoMesa = async (e) => {
    e.preventDefault();
    if (currentUser?.rol !== "admin") return;
    setMesaMsg("");
    const mesaClean = mesa.trim();
    if (!mesaClean) {
      setMesaMsg("El número de mesa es obligatorio.");
      return;
    }
    const toCount = (value) => Math.max(0, Number.parseInt(value, 10) || 0);
    const totalElectores = totalConteo({ votos: votosMesa, blancos: blancosMesa, nulos: nulosMesa, impugnados: impugnadosMesa });
    const conteo = {
      mesa: mesaClean,
      local: localMesa.trim() || "Sin local registrado",
      electores: totalElectores,
      votos: Object.fromEntries(PARTIDOS.map(({ id }) => [id, toCount(votosMesa[id])])),
      blancos: toCount(blancosMesa),
      nulos: toCount(nulosMesa),
      impugnados: toCount(impugnadosMesa),
      responsable: currentUser.nombre,
      ts: Date.now(),
    };
    setSavingMesa(true);
    try {
      const current = isFirebaseConfigured
        ? conteosMesas
        : await window.storage.get("conteo_mesas", true).then((res) => (res?.value ? JSON.parse(res.value) : conteosMesas)).catch(() => conteosMesas);
      const existing = current.find((item) => item.mesa.toString().toLowerCase() === mesaClean.toLowerCase());
      const saved = { ...conteo, id: existing?.id || uid() };
      const updated = existing ? current.map((item) => (item.id === existing.id ? saved : item)) : [saved, ...current];
      if (isFirebaseConfigured) {
        await setDoc(doc(conteosMesasCollection, saved.id), saved);
      } else {
        await window.storage.set("conteo_mesas", JSON.stringify(updated), true);
      }
      setConteosMesas(updated);
      resetMesaForm();
      setMesaMsg(existing ? "✓ Conteo de mesa actualizado." : "✓ Conteo de mesa guardado.");
      setLastSync(new Date());
    } catch (error_) {
      console.error("Save conteo mesa error:", error_);
      setMesaMsg("No se pudo guardar el conteo de la mesa.");
    } finally {
      setSavingMesa(false);
    }
  };

  const editConteoMesa = (conteo) => {
    if (currentUser?.rol !== "admin") return;
    setMesa(conteo.mesa);
    setLocalMesa(conteo.local || "");
    setElectoresMesa(String(conteo.electores || ""));
    setVotosMesa(Object.fromEntries(PARTIDOS.map(({ id }) => [id, String(conteo.votos?.[id] || "")] )));
    setBlancosMesa(String(conteo.blancos || ""));
    setNulosMesa(String(conteo.nulos || ""));
    setImpugnadosMesa(String(conteo.impugnados || ""));
    setMesaMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeConteoMesa = async (id) => {
    if (currentUser?.rol !== "admin") return;
    if (!window.confirm("¿Eliminar este conteo de mesa? Esta acción no se puede deshacer.")) return;
    try {
      if (isFirebaseConfigured) {
        await deleteDoc(doc(conteosMesasCollection, id));
      } else {
        const fresh = await window.storage.get("conteo_mesas", true).catch(() => null);
        const current = fresh?.value ? JSON.parse(fresh.value) : conteosMesas;
        await window.storage.set("conteo_mesas", JSON.stringify(current.filter((item) => item.id !== id)), true);
      }
      setConteosMesas((current) => current.filter((item) => item.id !== id));
    } catch (error_) {
      console.warn("Delete conteo mesa error:", error_);
      setMesaMsg("No se pudo eliminar el conteo.");
    }
  };

  const removeRegistro = async (id) => {
    try {
      if (isFirebaseConfigured) {
        await deleteDoc(doc(registrosCollection, id));
        setRegistros((current) => current.filter((r) => r.id !== id));
        return;
      }
      const fresh = await window.storage.get("registros", true).catch(() => null);
      const current = fresh?.value ? JSON.parse(fresh.value) : registros;
      const updated = current.filter((r) => r.id !== id);
      await window.storage.set("registros", JSON.stringify(updated), true);
      setRegistros(updated);
    } catch (e) {
      console.warn("Delete registro error:", e);
      setFormMsg("No se pudo eliminar el registro.");
    }
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditForm({ nombre: r.nombre, edad: r.edad || "", dni: r.dni || "", zona: r.zona });
    setFormMsg("");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id) => {
    if (!editForm.nombre.trim()) {
      setFormMsg("Nombre completo es obligatorio.");
      return;
    }
    try {
      const original = registros.find((r) => r.id === id);
      if (!original) {
        setEditingId(null);
        return;
      }
      const actualizado = {
        ...original,
        nombre: editForm.nombre.trim(),
        edad: editForm.edad.trim(),
        dni: editForm.dni.trim(),
        zona: editForm.zona.trim() || "Sin zona/calle",
      };
      if (isFirebaseConfigured) {
        await setDoc(doc(registrosCollection, id), actualizado);
        setRegistros((current) => current.map((r) => (r.id === id ? actualizado : r)));
      } else {
        const fresh = await window.storage.get("registros", true).catch(() => null);
        const current = fresh?.value ? JSON.parse(fresh.value) : registros;
        const updated = current.map((r) => (r.id === id ? actualizado : r));
        await window.storage.set("registros", JSON.stringify(updated), true);
        setRegistros(updated);
      }
      setEditingId(null);
    } catch (e) {
      console.warn("Edit registro error:", e);
      setFormMsg("No se pudo guardar la edición.");
    }
  };

  const addUsuario = async (e) => {
    e.preventDefault();
    setUserMsg("");
    if (!nuevoUsuario.trim() || !nuevaClave.trim() || !nuevoNombre.trim()) {
      setUserMsg("Completa usuario, contraseña y nombre del usuario.");
      return;
    }
    try {
      const current = usuarios || [DEFAULT_ADMIN];
      if (current.some((u) => u.usuario === nuevoUsuario.trim())) {
        setUserMsg("Ese usuario ya existe.");
        return;
      }
      const nuevo = {
        id: uid(),
        usuario: nuevoUsuario.trim(),
        clave: nuevaClave,
        rol: nuevoRol,
        nombre: nuevoNombre.trim(),
      };
      const updated = [...current, nuevo];
      if (isFirebaseConfigured) {
        await setDoc(doc(usuariosCollection, nuevo.id), nuevo);
        setUsuarios(updated);
      } else {
        await window.storage.set("usuarios", JSON.stringify(updated), true);
        setUsuarios(updated);
      }
      setNuevoUsuario("");
      setNuevaClave("");
      setNuevoNombre("");
      setNuevoRol("promotor");
      setUserMsg(nuevoRol === "admin" ? "✓ Administrador creado." : "✓ Promotor creado.");
    } catch (err) {
      console.error("Create usuario error:", err);
      setUserMsg("No se pudo crear el usuario.");
    }
  };

  const deleteUsuario = async (id) => {
    try {
      if (isFirebaseConfigured) {
        await deleteDoc(doc(usuariosCollection, id));
        setUsuarios((current) => current.filter((u) => u.id !== id));
        return;
      }
      const fresh = await window.storage.get("usuarios", true).catch(() => null);
      const current = fresh?.value ? JSON.parse(fresh.value) : usuarios || [];
      const updated = current.filter((u) => u.id !== id);
      await window.storage.set("usuarios", JSON.stringify(updated), true);
      setUsuarios(updated);
    } catch (e) {
      console.warn("Delete usuario error:", e);
      setUserMsg("No se pudo eliminar el usuario.");
    }
  };

  const registrosVisibles = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.rol === "admin") return registros;
    return registros.filter((r) => r.promotor === currentUser.nombre);
  }, [registros, currentUser]);

  const zonas = useMemo(() => [...new Set(registrosVisibles.map((r) => r.zona))], [registrosVisibles]);

  const promotores = useMemo(
    () => [...new Set(registrosVisibles.map((r) => r.promotor))].sort((a, b) => a.localeCompare(b)),
    [registrosVisibles]
  );

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

  const rankingPartidos = useMemo(() => {
    const totals = Object.fromEntries(PARTIDOS.map(({ id }) => [id, 0]));
    let blancos = 0;
    let nulos = 0;
    let impugnados = 0;
    conteosMesas.forEach((conteo) => {
      PARTIDOS.forEach(({ id }) => {
        totals[id] += Number(conteo.votos?.[id]) || 0;
      });
      blancos += Number(conteo.blancos) || 0;
      nulos += Number(conteo.nulos) || 0;
      impugnados += Number(conteo.impugnados) || 0;
    });
    const ordenados = PARTIDOS
      .map((partido) => ({ ...partido, votos: totals[partido.id] }))
      .sort((a, b) => b.votos - a.votos);
    const votosPartidos = ordenados.reduce((total, partido) => total + partido.votos, 0);
    return { ordenados, blancos, nulos, impugnados, votosPartidos, total: votosPartidos + blancos + nulos + impugnados };
  }, [conteosMesas]);

  const resumenMesas = useMemo(() => {
    const registradas = conteosMesas.length;
    const pendientes = Math.max(TOTAL_MESAS - registradas, 0);
    const avance = TOTAL_MESAS > 0 ? Math.min((registradas / TOTAL_MESAS) * 100, 100) : 0;
    const electores = conteosMesas.reduce((total, conteo) => total + (Number(conteo.electores) || 0), 0);
    return { registradas, pendientes, avance, electores };
  }, [conteosMesas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return registrosVisibles.filter((r) => {
      const matchesQuery =
        !q ||
        r.nombre.toLowerCase().includes(q) ||
        (r.dni || "").includes(q) ||
        r.zona.toLowerCase().includes(q) ||
        r.promotor.toLowerCase().includes(q);
      const matchesPromotor = !filterPromotor || r.promotor === filterPromotor;
      const matchesZona = !filterZona || r.zona === filterZona;
      return matchesQuery && matchesPromotor && matchesZona;
    });
  }, [registrosVisibles, query, filterPromotor, filterZona]);

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
        <form onSubmit={handleLogin} className="vs-login-card" noValidate>
          <div className="vs-brand">ET</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: RED_BRIGHT, marginBottom: 4, textAlign: "center" }}>
            Ciudad Eten
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 26, margin: "0 0 22px", textAlign: "center", color: INK }}>
            Conteo de Voto Seguro
          </h1>

          <label htmlFor="login-usuario" style={labelStyle}>Usuario</label>
          <input id="login-usuario" className="vs-input" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} placeholder="usuario" autoFocus />

          <label htmlFor="login-contrasena" style={labelStyle}>Contraseña</label>
          <input id="login-contrasena" className="vs-input" type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} placeholder="contraseña" />

          <button className="vs-btn vs-btn--primary" type="submit" style={{ width: "100%", marginTop: 16 }}>
            Ingresar
          </button>
          {loginError && <div style={{ marginTop: 10, fontSize: 13, color: RED_BRIGHT, textAlign: "center" }}>{loginError}</div>}
          {usuarios?.length === 1 && usuarios[0]?.id === "admin-1" && (
            <div style={{ marginTop: 14, fontSize: 11.5, color: INK, opacity: 0.6, textAlign: "center", lineHeight: 1.5 }}>
              Primer ingreso: usuario <b>admin</b>, contraseña <b>VotoSeguro2026</b>. Cámbiala luego creando otro usuario y eliminando este.
            </div>
          )}
          {!isFirebaseConfigured && (
            <div style={{ marginTop: 16, fontSize: 12, color: INK, opacity: 0.75, textAlign: "center", lineHeight: 1.6, border: "1px solid #d8c9b8", borderRadius: 12, background: "#fff8f0", padding: "12px 14px" }}>
              La aplicación está en modo local y no sincroniza entre dispositivos. Para usar Firestore y que los datos se compartan entre laptop y celular, configura las variables `VITE_FIREBASE_*` en un archivo <code>.env</code>.
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

      {/* TOP BANNER */}
      <div style={{ background: RED_DARK, color: GOLD, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", padding: "7px 12px" }}>
        Apoyo a Arq. Marlón Ñiquen Torres
      </div>

      {/* HERO */}
      <div className="vs-hero">
        <div className="vs-hero-inner">
          <div className="vs-hero-top">
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>
                Ciudad Eten
              </div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 30, margin: 0 }}>
                {activeView === "conteo" ? "Conteo de votos por mesas" : "Conteo de Voto Seguro"}
              </h1>
              {activeView === "dashboard" && (
                <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9, maxWidth: 560 }}>
                  Registro rápido para promotores, resumen por zona y exportación sencilla para el cierre de jornada.
                </div>
              )}
            </div>
            <div className="vs-hero-user">
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, opacity: 0.8 }}>
                {isAdmin ? "Administrador" : "Promotor"} · {currentUser.nombre}
              </div>
              <div className="vs-hero-actions">
                <button
                  onClick={refreshNow}
                  type="button"
                  className="vs-btn vs-btn--secondary"
                  disabled={refreshing}
                  style={{ opacity: refreshing ? 0.7 : 1 }}
                >
                  {refreshing ? "Actualizando…" : "↻ Actualizar"}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveView((view) => (view === "conteo" ? "dashboard" : "conteo"))}
                    type="button"
                    className="vs-btn vs-btn--secondary"
                  >
                    {activeView === "conteo" ? "← Resumen" : "Conteo por mesa"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setActiveView("dashboard");
                    setCurrentUser(null);
                  }}
                  type="button"
                  className="vs-btn vs-btn--secondary"
                >
                  Cerrar sesión
                </button>
              </div>
              {activeView === "dashboard" && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
                  <GoalRing value={registros.length} min={2500} max={3000} />
                </div>
              )}
            </div>
          </div>

          {activeView === "dashboard" && (
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
          )}
        </div>
      </div>

      {isAdmin && activeView === "conteo" && (
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 24px 0", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {[
            ["Total de mesas", TOTAL_MESAS, "mesas objetivo", RED],
            ["Mesas registradas", resumenMesas.registradas, `${resumenMesas.avance.toFixed(0)}% del total`, TEAL],
            ["Mesas pendientes", resumenMesas.pendientes, "mesas por registrar", RED_BRIGHT],
            ["Electores contabilizados", resumenMesas.electores.toLocaleString(), "según actas ingresadas", GOLD],
          ].map(([label, value, detail, color]) => (
            <div key={label} className="vs-panel" style={{ padding: 18, borderTop: `5px solid ${color}` }}>
              <div style={{ fontSize: 11, color: "#6D5B4B", textTransform: "uppercase", letterSpacing: 0.7 }}>{label}</div>
              <strong style={{ display: "block", marginTop: 7, color, fontFamily: "'IBM Plex Mono', monospace", fontSize: 30, lineHeight: 1 }}>{value}</strong>
              <div style={{ marginTop: 7, fontSize: 12, color: "#806F5E" }}>{detail}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, height: 10, background: "#E8DCCB", borderRadius: 6, overflow: "hidden" }} title={`${resumenMesas.avance.toFixed(0)}% de mesas registradas`}>
          <div style={{ width: `${resumenMesas.avance}%`, height: "100%", background: TEAL, borderRadius: 6, transition: "width 0.3s ease" }} />
        </div>
        <div className="vs-panel" style={{ order: 2, marginTop: 20, background: `linear-gradient(135deg, ${RED_DARK}, #7A1717)`, color: PAPER, border: "none", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: GOLD, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase" }}>Dashboard de resultados</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, marginTop: 4 }}>Quién va primero</div>
              <div style={{ fontSize: 13, opacity: 0.78, marginTop: 5 }}>Acumulado de {conteosMesas.length} {conteosMesas.length === 1 ? "mesa registrada" : "mesas registradas"}.</div>
            </div>
            <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>
              <div style={{ fontSize: 11, opacity: 0.72, textTransform: "uppercase" }}>Votos contabilizados</div>
              <strong style={{ fontSize: 28 }}>{rankingPartidos.votosPartidos.toLocaleString()}</strong>
            </div>
          </div>

          {rankingPartidos.votosPartidos === 0 ? (
            <div style={{ marginTop: 22, padding: "16px 18px", border: "1px dashed rgba(255,255,255,0.35)", borderRadius: 8, fontSize: 14, opacity: 0.85 }}>
              Ingresa los resultados de una mesa para ver el ranking.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginTop: 22 }}>
              {rankingPartidos.ordenados.slice(0, 3).map((partido, index) => {
                const percentage = rankingPartidos.votosPartidos ? (partido.votos / rankingPartidos.votosPartidos) * 100 : 0;
                return (
                  <div key={partido.id} style={{ background: index === 0 ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)", border: `1px solid ${index === 0 ? GOLD : "rgba(255,255,255,0.16)"}`, borderRadius: 8, padding: 15, display: "flex", alignItems: "center", gap: 12 }}>
                    <PartidoLogo partido={partido} size={index === 0 ? 54 : 46} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: index === 0 ? GOLD : "rgba(255,255,255,0.65)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, textTransform: "uppercase" }}>{index + 1}.° lugar</div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginTop: 3 }}>{partido.nombre}</div>
                      <strong style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20 }}>{partido.votos.toLocaleString()}</strong>
                      <span style={{ fontSize: 12, opacity: 0.72, marginLeft: 6 }}>{percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="vs-panel" style={{ order: 2, marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <div className="vs-section-title">Ranking por partido</div>
            <div style={{ fontSize: 12, opacity: 0.62 }}>Ordenado de mayor a menor</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            {rankingPartidos.ordenados.map((partido, index) => {
              const percentage = rankingPartidos.votosPartidos ? (partido.votos / rankingPartidos.votosPartidos) * 100 : 0;
              return (
                <div key={partido.id} style={{ display: "grid", gridTemplateColumns: "28px 48px minmax(150px, 1fr) 70px 58px", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${RULE}` }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: index === 0 && partido.votos > 0 ? RED : "#9A8A7A", textAlign: "center" }}>{index + 1}</span>
                  <PartidoLogo partido={partido} size={38} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{partido.nombre}</div>
                    <div style={{ height: 7, marginTop: 6, background: "#EEE3D3", borderRadius: 5, overflow: "hidden" }}><div style={{ width: `${percentage}%`, minWidth: partido.votos > 0 ? 5 : 0, height: "100%", background: partido.color, borderRadius: 5 }} /></div>
                  </div>
                  <strong style={{ fontFamily: "'IBM Plex Mono', monospace", textAlign: "right" }}>{partido.votos.toLocaleString()}</strong>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, opacity: 0.62, textAlign: "right" }}>{percentage.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 16, paddingTop: 12, borderTop: `1px solid ${RULE}`, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#6D5B4B" }}>
            <span>Blancos <b>{rankingPartidos.blancos}</b></span>
            <span>Nulos <b>{rankingPartidos.nulos}</b></span>
            <span>Impugnados <b>{rankingPartidos.impugnados}</b></span>
            <span>Total actas <b>{rankingPartidos.total}</b></span>
          </div>
        </div>

        <div className="vs-panel">
          <div className="vs-section-title">Conteo oficial por mesa</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4, marginBottom: 16 }}>
            Registra los resultados de cada acta. Si vuelves a ingresar una mesa, su conteo se actualizará.
          </div>
          <form onSubmit={saveConteoMesa}>
            <div className="vs-toolbar" style={{ alignItems: "end" }}>
              <div>
                <label htmlFor="conteo-mesa" style={labelStyle}>N.° de mesa</label>
                <input id="conteo-mesa" className="vs-input" value={mesa} onChange={(e) => setMesa(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Ej. 012345" inputMode="numeric" />
              </div>
              <div style={{ flex: "1 1 240px" }}>
                <label htmlFor="conteo-local" style={labelStyle}>Local de votación</label>
                <input id="conteo-local" className="vs-input" value={localMesa} onChange={(e) => setLocalMesa(e.target.value)} placeholder="Ej. I.E. Ciudad Eten" />
              </div>
              <div>
                <label htmlFor="conteo-electores" style={labelStyle}>Electores</label>
                <input id="conteo-electores" className="vs-input" value={totalConteo({ votos: votosMesa, blancos: blancosMesa, nulos: nulosMesa, impugnados: impugnadosMesa })} placeholder="Se calcula automáticamente" inputMode="numeric" readOnly style={{ background: "#F2ECE0", color: TEAL, fontWeight: 700 }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 8 }}>
              {PARTIDOS.map(({ id, nombre: partido }) => (
                <label key={id} style={{ fontSize: 12.5, fontWeight: 600, color: RED }}>
                  {partido}
                  <input className="vs-input" style={{ marginTop: 5 }} value={votosMesa[id]} onChange={(e) => setVotosMesa((current) => ({ ...current, [id]: e.target.value.replace(/\D/g, "") }))} placeholder="0" inputMode="numeric" />
                </label>
              ))}
              <label style={{ fontSize: 12.5, fontWeight: 600, color: TEAL }}>
                Votos blancos
                <input className="vs-input" style={{ marginTop: 5 }} value={blancosMesa} onChange={(e) => setBlancosMesa(e.target.value.replace(/\D/g, ""))} placeholder="0" inputMode="numeric" />
              </label>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: TEAL }}>
                Votos nulos
                <input className="vs-input" style={{ marginTop: 5 }} value={nulosMesa} onChange={(e) => setNulosMesa(e.target.value.replace(/\D/g, ""))} placeholder="0" inputMode="numeric" />
              </label>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: TEAL }}>
                Impugnados
                <input className="vs-input" style={{ marginTop: 5 }} value={impugnadosMesa} onChange={(e) => setImpugnadosMesa(e.target.value.replace(/\D/g, ""))} placeholder="0" inputMode="numeric" />
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>Total contabilizado: <b>{totalConteo({ votos: votosMesa, blancos: blancosMesa, nulos: nulosMesa, impugnados: impugnadosMesa })}</b></span>
              <button className="vs-btn vs-btn--primary" type="submit" disabled={savingMesa}>{savingMesa ? "Guardando…" : conteosMesas.some((item) => item.mesa === mesa.trim()) ? "Actualizar conteo" : "Guardar conteo de mesa"}</button>
            </div>
            {mesaMsg && <div style={{ marginTop: 10, fontSize: 13, color: mesaMsg.startsWith("✓") ? TEAL : RED_BRIGHT }}>{mesaMsg}</div>}
          </form>
        </div>

        <div className="vs-panel" style={{ marginTop: 20 }}>
          <div className="vs-section-title">Mesas registradas ({conteosMesas.length})</div>
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="vs-table">
              <thead>
                <tr><th>Mesa</th><th>Local</th><th>Electores</th>{PARTIDOS.map(({ id, nombre: partido }) => <th key={id}>{partido}</th>)}<th>Blancos</th><th>Nulos</th><th>Total</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {conteosMesas.slice().sort((a, b) => Number(a.mesa) - Number(b.mesa)).map((conteo) => (
                  <tr key={conteo.id}>
                    <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{conteo.mesa}</td>
                    <td>{conteo.local}</td>
                    <td>{conteo.electores || 0}</td>
                    {PARTIDOS.map(({ id }) => <td key={id}>{conteo.votos?.[id] || 0}</td>)}
                    <td>{conteo.blancos || 0}</td>
                    <td>{conteo.nulos || 0}</td>
                    <td style={{ fontWeight: 700 }}>{totalConteo(conteo)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button onClick={() => editConteoMesa(conteo)} type="button" className="vs-btn vs-btn--secondary" style={{ color: TEAL, padding: "6px 10px", marginRight: 8 }}>Editar mesa</button>
                      <button onClick={() => removeConteoMesa(conteo.id)} type="button" className="vs-btn vs-btn--secondary" style={{ color: RED_BRIGHT, padding: "6px 10px" }}>Eliminar mesa</button>
                    </td>
                  </tr>
                ))}
                {conteosMesas.length === 0 && <tr><td colSpan={PARTIDOS.length + 7} style={{ textAlign: "center", opacity: 0.5, padding: "24px 0" }}>Aún no hay mesas registradas.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {activeView === "dashboard" && (
        <div className="vs-grid" style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 24px 60px", display: "grid", gridTemplateColumns: "minmax(280px, 340px) 1fr", gap: 24 }}>
        {/* FORM */}
        <form onSubmit={addRegistro} className="vs-panel" style={{ alignSelf: "start" }} noValidate>
          <div className="vs-section-title" style={{ marginBottom: 14 }}>
            Nueva ficha de registro
          </div>

          <label htmlFor="registro-nombre" style={labelStyle}>Nombre completo</label>
          <input id="registro-nombre" className="vs-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. María Torres Ríos" />

          <label htmlFor="registro-edad" style={labelStyle}>Edad (opcional)</label>
          <input id="registro-edad" className="vs-input" style={{ fontFamily: "'IBM Plex Mono', monospace" }} value={edad} onChange={(e) => setEdad(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Ej. 34" inputMode="numeric" />

          <label htmlFor="registro-zona" style={labelStyle}>Zona o calle</label>
          <input id="registro-zona" className="vs-input" list="zonas-list" value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Ej. Etén Centro / Calle Grau 210" />
          <datalist id="zonas-list">{zonas.map((z) => <option key={z} value={z} />)}</datalist>

          <label htmlFor="registro-promotor" style={labelStyle}>Promotor responsable</label>
          <input id="registro-promotor" className="vs-input" style={{ background: "#F2ECE0", color: "#666" }} value={currentUser.nombre} disabled />

          <label htmlFor="registro-dni" style={labelStyle}>DNI (opcional)</label>
          <input id="registro-dni" className="vs-input" style={{ fontFamily: "'IBM Plex Mono', monospace" }} value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))} placeholder="Ej. 12345678" inputMode="numeric" />

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
                  <ProgressBar count={n} max={porZona[0][1]} color={RED} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: RED, minWidth: 22, textAlign: "right" }}>{n}</span>
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
                    <ProgressBar count={n} max={porPromotor[0][1]} color={TEAL} />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: TEAL, minWidth: 22, textAlign: "right" }}>{n}</span>
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
              {isAdmin && (
                <select className="vs-input" style={{ marginBottom: 0, width: "auto" }} value={filterPromotor} onChange={(e) => setFilterPromotor(e.target.value)}>
                  <option value="">Todos los promotores</option>
                  {promotores.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              <select className="vs-input" style={{ marginBottom: 0, width: "auto" }} value={filterZona} onChange={(e) => setFilterZona(e.target.value)}>
                <option value="">Todas las zonas</option>
                {zonas.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
              {(filterPromotor || filterZona) && (
                <button
                  onClick={() => { setFilterPromotor(""); setFilterZona(""); }}
                  type="button"
                  className="vs-btn vs-btn--ghost"
                >
                  Limpiar filtros
                </button>
              )}
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
                {filtered.slice().sort((a, b) => b.ts - a.ts).map((r) => {
                  if (editingId === r.id) {
                    return (
                      <tr key={r.id}>
                        <td>
                          <input className="vs-input" style={{ marginBottom: 0, minWidth: 140 }} value={editForm.nombre} onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))} autoFocus />
                        </td>
                        <td>
                          <input className="vs-input" style={{ marginBottom: 0, width: 64, fontFamily: "'IBM Plex Mono', monospace" }} value={editForm.edad} onChange={(e) => setEditForm((f) => ({ ...f, edad: e.target.value.replace(/\D/g, "").slice(0, 3) }))} inputMode="numeric" />
                        </td>
                        <td>
                          <input className="vs-input" style={{ marginBottom: 0, minWidth: 140 }} value={editForm.zona} onChange={(e) => setEditForm((f) => ({ ...f, zona: e.target.value }))} />
                        </td>
                        {isAdmin && <td>{r.promotor}</td>}
                        <td>
                          <input className="vs-input" style={{ marginBottom: 0, width: 100, fontFamily: "'IBM Plex Mono', monospace" }} value={editForm.dni} onChange={(e) => setEditForm((f) => ({ ...f, dni: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" />
                        </td>
                        <td style={{ opacity: 0.6 }}>{new Date(r.ts).toLocaleDateString()}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button onClick={() => saveEdit(r.id)} type="button" style={{ border: "none", background: "none", color: TEAL, cursor: "pointer", fontSize: 12, fontWeight: 600, marginRight: 10 }}>
                            Guardar
                          </button>
                          <button onClick={cancelEdit} type="button" style={{ border: "none", background: "none", color: INK, opacity: 0.6, cursor: "pointer", fontSize: 12 }}>
                            Cancelar
                          </button>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={r.id}>
                      <td>{r.nombre}</td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", opacity: r.edad ? 1 : 0.6 }}>{r.edad || "—"}</td>
                      <td>{r.zona}</td>
                      {isAdmin && <td>{r.promotor}</td>}
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace", opacity: r.dni ? 1 : 0.4 }}>{r.dni || "—"}</td>
                      <td style={{ opacity: 0.6 }}>{new Date(r.ts).toLocaleDateString()}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button onClick={() => startEdit(r)} type="button" style={{ border: "none", background: "none", color: TEAL, cursor: "pointer", fontSize: 12, marginRight: 10 }}>
                          Editar
                        </button>
                        <button onClick={() => removeRegistro(r.id)} type="button" style={{ border: "none", background: "none", color: RED_BRIGHT, cursor: "pointer", fontSize: 12 }}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
            <div className="vs-section-title">Cuentas de usuarios</div>
            <form onSubmit={addUsuario} style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }} noValidate>
              <div style={{ flex: "1 1 150px", minWidth: 130 }}>
                <label htmlFor="nuevo-nombre" style={labelStyle}>Nombre completo</label>
                <input id="nuevo-nombre" className="vs-input" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Ej. Juan Pérez" />
              </div>
              <div style={{ flex: "1 1 150px", minWidth: 130 }}>
                <label htmlFor="nuevo-usuario" style={labelStyle}>Usuario</label>
                <input id="nuevo-usuario" className="vs-input" value={nuevoUsuario} onChange={(e) => setNuevoUsuario(e.target.value)} placeholder="usuario" />
              </div>
              <div style={{ flex: "1 1 150px", minWidth: 130 }}>
                <label htmlFor="nuevo-clave" style={labelStyle}>Contraseña</label>
                <input id="nuevo-clave" className="vs-input" value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} placeholder="contraseña" />
              </div>
              <div style={{ flex: "1 1 150px", minWidth: 130 }}>
                <label htmlFor="nuevo-rol" style={labelStyle}>Rol</label>
                <select id="nuevo-rol" className="vs-input" value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value)}>
                  <option value="promotor">Promotor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <button className="vs-btn vs-btn--primary" type="submit" style={{ flex: "1 1 100%" }}>
                Crear cuenta
              </button>
            </form>
            <div style={{ marginTop: 10, fontSize: 12, color: "#5f4a3e", opacity: 0.8 }}>
              Eliminar un usuario no borra los registros que haya creado.
            </div>
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
      )}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12.5, fontWeight: 600, color: RED, marginTop: 12, marginBottom: 5 };
