# Conteo de Voto Seguro · Etén

App para que promotores de campaña registren votos seguros (nombre, edad, zona/calle, DNI opcional) con acceso separado por rol.

## Publicación en GitHub Pages

1. Crea un repositorio en GitHub con el nombre `voto-seguro-eten`.
2. Desde la carpeta del proyecto ejecuta:

```bash
git init
git add .
git commit -m "Primera versión"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/voto-seguro-eten.git
git push -u origin main
```

3. En GitHub ve a Settings > Pages y habilita Deploy from a branch usando la rama `main` y la carpeta `/root`.
4. Si prefieres despliegue automático, el proyecto ya incluye un workflow listo en `.github/workflows/deploy.yml`.

## Cómo abrir en VS Code

1. Descomprime la carpeta y ábrela en VS Code (`Archivo > Abrir carpeta…`).
2. Abre una terminal en VS Code (`Terminal > Nueva terminal`) y ejecuta:
   ```bash
   npm install
   npm run dev
   ```
3. Abre el link que aparece en la terminal (normalmente `http://localhost:5173`).

Necesitas tener [Node.js](https://nodejs.org/) instalado (versión 18 o superior).

## Primer ingreso

- **Usuario:** `admin`
- **Contraseña:** `VotoSeguro2026`

Apenas entres, crea tu propio usuario administrador con otra contraseña (agregando una cuenta con rol de administrador directamente en `src/App.jsx` si quieres, o pídeme ayuda para agregar esa opción al panel) y no compartas la cuenta `admin` por defecto.

## ⚠️ Limitación importante: los datos NO se comparten entre dispositivos

Esta versión guarda los datos en el `localStorage` del navegador (un archivo del propio navegador), **no en un servidor**. Eso significa:

- Cada computadora o celular que abra la app tiene **su propia copia** de los registros y usuarios — no se sincronizan entre sí.
- Si borras el caché/datos del navegador, se pierde la información.
- Es perfecta para probar la app o para que **una sola persona** la use en un dispositivo, pero **no sirve tal cual** para que varios promotores vean el mismo conteo en tiempo real desde distintos celulares.

### Si necesitas sincronización real entre dispositivos

Para que todos los promotores compartan el mismo conteo en vivo, la app necesita un backend con base de datos. Opciones razonables, de más simple a más robusta:

1. **Firebase (Firestore) o Supabase** — servicios listos para usar, con un plan gratuito que probablemente te alcance para una campaña. Solo hay que reemplazar el archivo `src/storage.js` por las llamadas a su SDK.
2. **Un pequeño servidor propio** (Node.js + Express + una base de datos como PostgreSQL o SQLite), si prefieres tener el control total de dónde viven los datos.

Dime si quieres que te arme cualquiera de las dos opciones y seguimos desde ahí.

## Estructura del proyecto

```
voto-seguro-eten/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx       # punto de entrada
│   ├── App.jsx        # toda la app (login, formulario, tablero, gestión de usuarios)
│   └── storage.js      # capa de almacenamiento (hoy: localStorage)
└── README.md
```
