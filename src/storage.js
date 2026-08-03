// Shim que imita la API window.storage de los artefactos de Claude,
// pero usando localStorage del navegador (persistencia LOCAL, por dispositivo).
//
// IMPORTANTE: esto NO sincroniza datos entre distintos dispositivos o navegadores.
// Cada computadora/celular tendrá su propia copia de los datos guardados en su
// localStorage. Si necesitas que todos los promotores vean el mismo conteo en
// tiempo real desde distintos dispositivos, necesitas un backend real (por
// ejemplo Firebase, Supabase, o un pequeño servidor con base de datos). Ver el
// README.md de este proyecto para más detalles.

const NAMESPACE = "voto-seguro-eten";

function buildKey(key, shared) {
  return `${NAMESPACE}:${shared ? "shared" : "local"}:${key}`;
}

async function get(key, shared = false) {
  const raw = window.localStorage.getItem(buildKey(key, shared));
  if (raw === null) {
    throw new Error(`Key "${key}" not found`);
  }
  return { key, value: raw, shared: !!shared };
}

async function set(key, value, shared = false) {
  window.localStorage.setItem(buildKey(key, shared), value);
  return { key, value, shared: !!shared };
}

async function del(key, shared = false) {
  window.localStorage.removeItem(buildKey(key, shared));
  return { key, deleted: true, shared: !!shared };
}

async function list(prefix = "", shared = false) {
  const nsPrefix = `${NAMESPACE}:${shared ? "shared" : "local"}:`;
  const keys = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const fullKey = window.localStorage.key(i);
    if (fullKey && fullKey.startsWith(nsPrefix)) {
      const bareKey = fullKey.slice(nsPrefix.length);
      if (bareKey.startsWith(prefix)) keys.push(bareKey);
    }
  }
  return { keys, prefix, shared: !!shared };
}

const storage = { get, set, delete: del, list };

if (typeof window !== "undefined") {
  window.storage = storage;
}

export default storage;
