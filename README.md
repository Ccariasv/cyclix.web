# Cyclix Web

Repositorio del frontend de Cyclix, servido con Vite desde la raiz del proyecto.

## Frontend

El zip original traia el frontend solo compilado. Para conservar esa version funcional exacta, el proyecto sirve ese bundle desde `public/assets` mediante `index.html`.

Scripts disponibles:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`

En desarrollo, Vite proxya `/api` hacia `http://127.0.0.1:6060` o hacia `VITE_API_BASE_URL` si esta definido.

## Notas

- `DESIGN_THEME.md` se conserva como referencia visual del frontend fuente original.
- El bundle servido en `index.html` corresponde al frontend compilado entregado en el zip.
