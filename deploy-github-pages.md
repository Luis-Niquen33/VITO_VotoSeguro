# Publicar en GitHub Pages

1. Crea un repositorio en GitHub.
2. Desde la carpeta del proyecto ejecuta:

```bash
git init
git add .
git commit -m "Primera versión"
git branch -M main
git remote add origin https://github.com/tu-usuario/tu-repo.git
git push -u origin main
```

3. En GitHub, entra a Settings > Pages y selecciona Deploy from a branch.
4. Elige la rama `main` y la carpeta `/root` o `/docs`.

Si quieres, puedo dejar el proyecto ya configurado para publicar automáticamente con GitHub Actions.
