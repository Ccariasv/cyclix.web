# Cyclix

Este repo ahora contiene:

- frontend en la raiz, servido con Vite
- `backend/` con la API Spring Boot incluida en el zip

## Frontend

El zip traia el frontend solo compilado. Para conservar esa version funcional exacta, el proyecto sirve ese bundle desde `public/assets` mediante `index.html`.

Scripts disponibles:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`

En desarrollo, Vite proxya `/api` hacia `http://127.0.0.1:6060` o hacia `VITE_API_BASE_URL` si esta definido.

## Backend

La API del zip se agrego en [backend](backend).

Archivos principales:

- [backend/build.gradle.kts](backend/build.gradle.kts)
- [backend/src/main/resources/application.properties](backend/src/main/resources/application.properties)
- [backend/README.md](backend/README.md)

Ejecucion local desde `backend/`:

```powershell
.\gradlew.bat bootRun
```

## Notas

- `DESIGN_THEME.md` se conserva como referencia visual del frontend fuente original.
- El bundle servido en `index.html` corresponde al frontend compilado entregado en el zip.
