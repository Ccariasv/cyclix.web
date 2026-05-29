# Tema de Diseno Cyclix

Este documento define el lenguaje visual obligatorio del proyecto. Cualquier cambio de interfaz debe conservar esta linea de diseno salvo que exista una solicitud explicita para redisenar el producto.

## Objetivo visual

Cyclix no es una landing page ni una app editorial. Es una consola operativa para administracion de flota. La UI debe sentirse:

- sobria
- utilitaria
- limpia
- clara para escaneo rapido
- moderna pero no decorativa

La prioridad es legibilidad operativa, densidad controlada de informacion y consistencia entre login, dashboard, formularios, tablas, mapas y modales.

## Identidad visual obligatoria

- Tipografia principal: `Manrope`, con respaldo `Segoe UI`, `sans-serif`.
- Base general: superficies claras, paneles blancos, fondo muy claro con matiz azul gris.
- Navegacion principal: sidebar oscuro y topbar oscura.
- Color primario: azul operativo.
- Color de confirmacion/accion positiva: verde vivo.
- Colores de estado auxiliares: naranja para advertencia o mantenimiento, rojo para error, riesgo o bateria baja.
- Bordes suaves y modernos: redondeado medio/alto, pero sin apariencia infantil ni marketing-heavy.
- Sombras sutiles y limpias, nunca dramaticas.

## Paleta base

Usar esta paleta como referencia. Se puede variar ligeramente dentro del mismo rango visual, pero no cambiar la identidad general.

- `#2a7bda` azul primario
- `#47a2ff` azul gradiente de apoyo
- `#1976d2` azul del login y focos
- `#09c957` o `#00c853` verde principal
- `#ef7d14` naranja de mantenimiento
- `#e74d5b` rojo de alertas
- `#16233b` texto fuerte en paneles claros
- `#5f6d82` a `#617289` texto secundario
- `#f7fafc`, `#eef4fa`, `#fbfdff` fondos claros
- `#222222`, `#242424`, `#1f1f1f`, `#2b2b2b` fondos oscuros de shell
- `#ffffff` superficie principal

## Estructura de layout

### Login

- Pantalla centrada.
- Fondo blanco o gris muy claro con halo radial azul sutil.
- Tarjeta compacta, clara, con sombra suave.
- CTA principal en verde.
- Inputs blancos con borde azul muy suave y focus azul claro.

### Admin

- Shell principal con `sidebar` oscura a la izquierda.
- `topbar` oscura, compacta, sin ornamentos.
- Contenido principal sobre fondo claro con gradiente muy sutil azul gris.
- Contenedor de contenido con ancho maximo aproximado de `1180px`.
- Uso de grids para KPIs, paneles y formularios.

## Componentes y reglas

### Tarjetas

- Fondo blanco.
- Borde fino gris azulado.
- Radio entre `18px` y `22px` en superficies principales.
- Sombras suaves, dobles y difusas.

### Botones

- Boton primario: gradiente azul.
- Boton secundario: fondo azul muy claro, texto azul.
- Boton de peligro: fondo rosa claro, texto rojo.
- Boton CTA del login: verde solido.
- Hover con elevacion minima, no animaciones llamativas.

### Inputs y selects

- Fondo claro.
- Borde fino azul gris.
- Focus con borde azul y halo suave.
- Altura comoda para uso administrativo.

### Etiquetas y estados

- Azul: disponible o estado base.
- Verde: correcto, activo, en uso saludable, exito.
- Naranja: mantenimiento, advertencia, proceso intermedio.
- Rojo: error, ticket abierto critico, bateria baja, riesgo.

### Tablas

- Estilo limpio, sin rejillas pesadas.
- Separadores horizontales suaves.
- En movil, convertir filas a bloques legibles.

### Mapa

- Debe integrarse como herramienta operativa, no como adorno.
- Leyendas, chips y panel lateral deben usar el mismo sistema visual del dashboard.

## Lo que no se debe hacer

- No convertir la app en una landing page.
- No usar heroes de marketing.
- No introducir paletas moradas, beige, cafe o neones fuera del sistema actual.
- No reemplazar el sidebar oscuro por una navegacion clara.
- No usar cards dentro de cards sin necesidad real.
- No aumentar demasiado los radios para que todo parezca juguete.
- No usar sombras pesadas, blur excesivo o efectos glassmorphism.
- No meter gradients decorativos fuera de botones primarios, fondos muy sutiles o estados ya existentes.
- No cambiar la tipografia.
- No usar ilustraciones decorativas ni bloques visuales que compitan con la informacion operativa.
- No romper la densidad actual con demasiado espacio vacio.
- No saturar la pantalla con demasiados colores nuevos.

## Tono de interfaz

- Texto corto y directo.
- Etiquetas operativas.
- Nada promocional.
- Nada aspiracional.
- Nada de copy de marketing.

## Prompt maestro para ChatGPT o Codex

Copia y pega esto cuando alguien vaya a tocar la interfaz:

```text
Trabaja sobre la UI existente de Cyclix sin redisenarla. Conserva estrictamente el tema visual actual:

- App administrativa y operativa, no marketing.
- Tipografia Manrope.
- Sidebar y topbar oscuras.
- Superficies principales claras con cards blancas.
- Fondo general claro con matiz azul gris muy sutil.
- Color primario azul (#2a7bda / #47a2ff / #1976d2).
- Verde para acciones positivas y CTA de login (#09c957 / #00c853).
- Naranja para mantenimiento/advertencia (#ef7d14).
- Rojo para alertas o bateria baja (#e74d5b).
- Texto fuerte azul marino oscuro (#16233b) y secundarios gris azulado.
- Bordes finos, radios de 14px a 22px, sombras suaves.
- Layout denso, claro y profesional para dashboard, tablas, formularios y mapa.

Reglas obligatorias:
- No cambies la identidad visual.
- No cambies la tipografia.
- No conviertas ninguna vista en landing page.
- No uses estilos decorativos ajenos al sistema actual.
- Reutiliza patrones existentes de cards, tags, botones, inputs, tablas y paneles.
- Manten consistencia con el login y el panel admin ya implementados.
- Si hace falta agregar UI nueva, debe parecer parte del mismo sistema ya existente.

Antes de proponer cambios visuales, toma como referencia principal los archivos:
- src/App.css
- src/index.css
- src/admin/styles.css

Implementa solo cambios compatibles con ese lenguaje visual.
```

## Regla de trabajo para el proyecto

Si alguien pide "mejora esta pantalla", "agrega este modulo" o "hazla mas bonita", la instruccion correcta es:

1. mantener el tema actual de Cyclix
2. reutilizar componentes y patrones existentes
3. no introducir un nuevo sistema visual
4. documentar cualquier excepcion visual antes de implementarla

## Archivos fuente del tema actual

- `src/index.css`
- `src/App.css`
- `src/admin/styles.css`
