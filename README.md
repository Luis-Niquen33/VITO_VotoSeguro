# Conteo de Voto Seguro · Etén

App full-stack para que promotores de campaña registren votos seguros y un administrador vea el consolidado. Ahora con **backend real (Node/Express) + base de datos PostgreSQL 17**, así que los datos sí se sincronizan entre celulares y computadoras distintas.

```
voto-seguro-eten/
├── docker-compose.yml   # Postgres 17 para correr localmente
├── server/              # API en Express
└── client/              # App en React (Vite)
```

Contraseñas guardadas con hash (bcrypt) y sesiones con JWT — mucho más seguro que la versión anterior basada en localStorage.

---

## 1. Abrir en VS Code

Descomprime la carpeta y ábrela en VS Code (`Archivo > Abrir carpeta…`). Necesitas [Node.js 18+](https://nodejs.org/) instalado.

## 2. Levantar PostgreSQL 17 localmente

La forma más simple es con Docker (si no lo tienes, instala [Docker Desktop](https://www.docker.com/products/docker-desktop/)):

```bash
docker compose up -d
```

Esto levanta un PostgreSQL 17 en `localhost:5432` con usuario `postgres`, contraseña `postgres`, base de datos `voto_seguro`.

> ¿No quieres usar Docker? Instala PostgreSQL 17 directamente en tu máquina y crea una base de datos llamada `voto_seguro`; luego ajusta `DATABASE_URL` en el paso siguiente.

## 3. Backend (API)

En una terminal:

```bash
cd server
cp .env.example .env
npm install
npm run migrate   # crea las tablas y el usuario admin por defecto
npm run dev       # levanta la API en http://localhost:4000
```

La migración imprime el usuario/contraseña del administrador creado (por defecto `admin` / `VotoSeguro2026`, definido en `.env`). **Cámbialo** antes de usar en producción, o crea otro admin y luego ajusta el `.env`.

## 4. Frontend (app)

En otra terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev       # abre en http://localhost:5173
```

Abre `http://localhost:5173` — deberías ver la pantalla de login "Conteo de Voto Seguro · Etén".

> Si quieres sincronizar datos entre laptop y celular, copia las claves de Firebase a `client/.env` usando las variables `VITE_FIREBASE_*` del ejemplo. Cuando el frontend tenga esas variables, usará Firebase en lugar de localStorage.

---

## 5. Conectarlo con GitHub

Desde la raíz del proyecto (`voto-seguro-eten/`):

```bash
git init
git add .
git commit -m "Primera versión: Conteo de Voto Seguro"
```

Luego, en GitHub:

1. Crea un repositorio nuevo (vacío, sin README) en https://github.com/new.
2. Copia la URL que te da (algo como `https://github.com/tu-usuario/voto-seguro-eten.git`).
3. Conéctalo y sube el código:

```bash
git remote add origin https://github.com/tu-usuario/voto-seguro-eten.git
git branch -M main
git push -u origin main
```

El archivo `.gitignore` ya excluye `node_modules`, `dist` y los `.env` (con tus contraseñas/secretos), así que no se subirán por accidente.

---

## 6. Ponerlo en línea (para usarlo desde el celular, desde cualquier lugar)

Necesitas hospedar tres cosas: la base de datos, la API, y el frontend. Una combinación simple y con buen nivel gratuito:

### Opción recomendada: Railway (API + Postgres) + Vercel (frontend)

**Base de datos y API en Railway:**
1. Entra a [railway.app](https://railway.app) y conecta tu cuenta de GitHub.
2. Crea un proyecto nuevo → "Deploy from GitHub repo" → selecciona tu repo.
3. Añade un servicio de **PostgreSQL** desde el marketplace de Railway (te da automáticamente una variable `DATABASE_URL`).
4. En el servicio de tu API (carpeta `server`), configura:
   - **Root directory**: `server`
   - **Start command**: `npm start`
   - Variables de entorno: `DATABASE_URL` (copia la que generó el Postgres de Railway), `JWT_SECRET` (uno largo y aleatorio), `ADMIN_DEFAULT_USER`, `ADMIN_DEFAULT_PASS`, `ADMIN_DEFAULT_NAME`, `CORS_ORIGIN` (la URL de tu frontend, la agregas después).
5. Corre la migración una vez, desde la consola/shell de Railway del servicio: `npm run migrate`.
6. Railway te da una URL pública para tu API, ej. `https://voto-seguro-eten-api.up.railway.app`.

**Frontend en Vercel:**
1. Entra a [vercel.com](https://vercel.com) y conecta tu cuenta de GitHub.
2. "Add New Project" → selecciona tu repo.
3. **Root directory**: `client`.
4. Variable de entorno: `VITE_API_URL` = la URL pública de tu API en Railway.
5. Deploy. Vercel te da una URL pública, ej. `https://voto-seguro-eten.vercel.app` — ese es el link que abres desde el celular.
6. Vuelve a Railway y actualiza `CORS_ORIGIN` con esta URL de Vercel, para que solo tu frontend pueda hablar con tu API.

Con ambos conectados a GitHub, cada vez que hagas `git push` a `main`, se actualizan solos (CI/CD automático).

### Alternativas

- **Render.com**: similar a Railway, también soporta Postgres + servicios Node + sitios estáticos, todo conectado a GitHub.
- **Supabase**: si prefieres que la base de datos la administre un proveedor con panel visual (incluye Postgres real), y despliegas la API en Render/Railway apuntando a esa `DATABASE_URL`.

---

## Notas de seguridad para producción

- Cambia `JWT_SECRET` y la contraseña del admin por defecto antes de compartir el link con tu equipo.
- Ajusta `CORS_ORIGIN` en el servidor a la URL exacta de tu frontend (evita dejarlo en `*`).
- Considera activar HTTPS (Railway/Render/Vercel lo hacen automáticamente).
- Este sistema separa el acceso por rol (admin ve todo, promotor ve solo lo suyo), pero sigue siendo una app de campaña, no un sistema con auditoría electoral formal — no la uses para nada que requiera cumplimiento legal estricto sin revisión adicional.
