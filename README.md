# Auditor 3D de accesibilidad cromática — v1

Escena 3D de un andén de TransMilenio que audita, **objeto por objeto**, qué se vuelve indistinguible para protan, deutan y tritan, contra qué fondo y con qué luz. WebGL2 + GLSL ES 3.00 + JavaScript puro. Sin frameworks. Sin build. Activos 100 % locales.

**Demo:** https://auditor-3d.vercel.app/

**Relación con el Proyecto 1 ([daltonizador-web](https://github.com/its-camilo/daltonizador-web)):** el P1 filtra una imagen plana: el color (y el contraste WCAG) cambia con la simulación, pero la escena es fija. Aquí la **luz es una variable** (puntual, az/el/**distancia**) y además se pueden encadenar **afectaciones ópticas** (miopía, astigmatismo) antes del daltonismo. La simulación Machado/Brettel vive en `shaders/daltonismo.frag` (`uInputLinear = 1` sobre RGB lineal del FBO).

**Esta versión incluye:** escena Blinn–Phong con **luz puntual** y **marcador 3D** sincronizado (`uLightPos` único por frame); panel **Condiciones** (daltonismo, miopía, astigmatismo, orden óptica↔color); auditoría con etiqueta `conditionLabel()` según condiciones activas (sin forzar «deutan» si el daltonismo está apagado); verificación automatizada en `tools/capture-screenshots.mjs` y `docs/verificacion-luz-marcador.md`.

## Uso local

Sirve cualquier servidor estático sobre la raíz del repo (los shaders y los `.obj` se cargan con `fetch`):

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Verificación numérica de la teoría (mismo núcleo que el HUD):

```bash
node tools/teoria-conmutacion.js 1.0
node tools/capture-screenshots.mjs   # requiere servidor en :8765 y Playwright (SwiftShader)
```

Requisitos: navegador con **WebGL2** (Chrome, Brave, Firefox, Safari recientes). `EXT_color_buffer_float` mejora el buffer de color (RGBA16F); sin la extensión se usa RGBA8.

## Controles

| Acción | Control |
|--------|---------|
| Orbitar cámara | Arrastrar en el canvas |
| Zoom | Rueda del ratón |
| Seleccionar objeto para auditar | Clic en la escena |
| Deseleccionar | Segundo clic en el mismo objeto (escena o lista) |
| Marcas de accesibilidad (contorno/patrón) | Tecla **H** o selector «Marcas»: rayas, doble línea, puntos WCAG; apagadas |
| Condiciones | Panel **Condiciones:** casillas daltonismo, miopía (\|D\|, pupila), astigmatismo (cilindro, eje); select **Orden** (óptica→color / color→óptica). Cada etapa activa usa su shader (`miopia.frag`, `astigmatismo.frag`, `daltonismo.frag`) en ping-pong. |
| Tipo y severidad | Selectores «Tipo» y «Severidad» (solo si daltonismo está activo) |
| Luz | Azimut, elevación, **distancia (2–12 m, defecto 4 m)**, presets de color; casilla **marca del origen** — disco amarillo 3D (`marcaluz`) en la posición de la fuente |
| Resumen auditoría | Línea superior del HUD: prefijo según condiciones (`sin condiciones`, `deutan + miopía 4 D`, etc.) + conteos de fallas y confusiones |

Leyenda de marcas (no dependen solo del color, SC 1.4.1): rayas = no se distingue del fondo; doble línea = se confunde con otro objeto; punteado = WCAG < 3:1.

## Arquitectura

1. **Escena → FBO (MRT + profundidad).** `shaders/escena.vert|frag`: color lineal, ID y mapa de profundidad (picking y gather).
2. **Cadena Pipe (ping-pong):** etapas activas en orden elegido (`shaders/miopia.frag`, `shaders/astigmatismo.frag`, `shaders/daltonismo.frag`); buffers A/B RGBA16F; profundidad fija como `uDepth`. Si ninguna etapa está activa, `shaders/mostrar.frag` convierte la escena lineal a sRGB.
3. **Heatmap** sobre IDs nítidos (`shaders/heatmap.frag`).
4. **Marca de luz** (`shaders/marcaluz.vert|frag`); no escribe IDs.

**Picking:** IDs de la pasada de escena, sin desenfoque.

**Auditoría (CPU):** promedios desde `texAuditSrc` según el orden del pipe — **óptica→color:** tras óptica y **antes** de daltonismo (Machado una vez en CPU); **color→óptica** con ambas etapas: tras la cadena completa (daltonismo ya en buffer, sin segunda pasada CPU). Confusiones entre objetos solo si daltonismo está activo. IDs desde la escena; ver nota en el HUD si hay óptica.

```
[ Escena + Blinn-Phong ] ──► color + ID + depth
         │
         ▼  (ping-pong A/B si sim)
[ miopía ] → [ astigmatismo ] → [ daltonismo ] → pantalla
         │                              │
         ▼                              ▼
   IDs ──► heatmap              color audit ──► ΔE / WCAG
         │
         ▼
   marcaluz (UI)
```

Detalle óptico: `docs/miopia-astigmatismo.md`.

## Métricas

- **ΔE en OKLab** entre color medio del objeto y fondo adyacente **en el espacio ya simulado**. Umbral provisional **τ = 0,08** (calibración pendiente con usuarios; un JND ronda 0,02).
- **WCAG 2.x** razón de luminancia relativa **3:1** (SC 1.4.11, criterio secundario de aviso).
- **APCA (WCAG 3):** solo discusión en `docs/revision-teorica.md`; no implementada en la app.

Estado por figura: *falla* si ΔE < τ; *aviso* si ΔE ≥ τ pero contraste < 3:1; *confusión entre objetos* si en visión normal ΔE ≥ 0,10 y en el tipo simulado ΔE < τ (pares de figuras).

Derivación paso a paso de los números del HUD: sección **4.1** de `docs/revision-teorica.md`.

## De la teoría al código

| Concepto | Código | Notas |
|---------|--------|--------|
| Simulación lineal RGB (Machado, Brettel) | `js/machado.js`, `shaders/daltonismo.frag` | Del P1; etapa del pipe |
| Multipass / ping-pong | `runPipeToScreen()` en `js/main.js` | Pipe del notebook Visual |
| Miopía (DOF / CoC) | `shaders/miopia.frag` | Dioptrías, pupila, gather espiral |
| Astigmatismo anisotrópico | `shaders/astigmatismo.frag` | Cilindro + eje |
| Posición de luz (UI) | `currentLightPos()` en `js/main.js` → `uLightPos` en escena + `marcaluz` | Una sola fuente por frame |
| Marcador de luz 3D | `shaders/marcaluz.*` | Billboard con oclusión por `texDepth`; sin indicador 2D en el borde |
| Blinn-Phong (luz puntual) | `shaders/escena.frag`, `blinnPhong()` en `js/audit-core.js` | `L = normalize(pos - x)`, atenuación `k = 0,035` |
| Proposición 1 (luz blanca) | `tools/teoria-conmutacion.js` | ΔE ≈ 0 con D65; error con luz de color |
| Fondo adyacente WCAG | `runAudit()` en `js/main.js` | CPU, anillo 6 px (JFA pendiente) |
| ΔE + WCAG + sugerencia | `pairMetrics()`, `suggest()` en `js/audit-core.js` | OKLab / OKLCH |
| Escena y materiales | `js/scene.js` | Tabla `OBJECTS` + luces |
| Modelos | `models/*.obj`, `js/obj.js`, `tools/generar-modelos.py` | Lector OBJ propio |

Más detalle: `docs/avance-1.md`, `docs/explicacion-sencilla.md`.

## Generación de modelos

`tools/generar-modelos.py` construye los OBJ del andén, señales (mapa de rutas, letras H/B), bus y banca (~24k triángulos). Cada entrada de `js/scene.js` enlaza `model` + `part` con un objeto `o` del archivo. Un export de Blender puede sustituir un modelo si los nombres `o` coinciden.

## Estructura del repositorio

```
index.html, style.css     # shell y HUD
js/                       # host WebGL, escena, auditoría, Machado, lector OBJ
shaders/                  # escena, miopia, astigmatismo, daltonismo, heatmap, marcaluz
models/                   # Wavefront OBJ locales
tools/                    # generar-modelos.py, teoria-conmutacion.js, color.js
docs/                     # revisión teórica, avances, notas del profesor
```

## Limitaciones y trabajo pendiente

**Documentados en código/teoría pero no implementados aún**

- **Jump Flooding / ping-pong en GPU** para el anillo de fondo: la teoría y comentarios lo mencionan; la auditoría sigue en **CPU** con muestreo a 6 px.
- **Sugerencias de color:** escalan el RGB total por la razón albedo sugerido/actual, así que el **especular** se escala junto con el difuso.
- **Confusión entre objetos** no entra en la lógica de sugerencias (solo en estado y marcas).
- **Promedio antes de simular:** la auditoría promedia colores renderizados y luego aplica métricas; el orden de clamp respecto al shader puede diferir ligeramente.
- **`heatmap.frag`:** `texelFetch` puede leer fuera de rango cerca de los bordes del buffer de estado.

**Notas del profesor** (`docs/trabajo-pendiente.md`): explorar por qué los exámenes de miopía no usan pantallas de PC (véase `docs/miopia-astigmatismo.md`).

**Otros pendientes del avance:** calibrar colores con el Manual de Imagen TransMilenio; calibrar τ con usuarios; mapa de ángulos ciegos interactivo; prototipo «Ishihara 3D»; documento de requisitos estilo ASD-STE100.

## Referencias

Machado, Oliveira y Fernandes 2009; Brettel, Viénot y Mollon 1997; Blinn 1977; Ottosson 2020 (OKLab); WCAG 2.2 SC 1.4.1 y 1.4.11; Rong y Tan 2006 (JFA); Kuhn et al. 2008; Zhang et al. 2023 (Iris).
