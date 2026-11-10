# Auditor 3D de accesibilidad cromática — v1

Escena 3D de un andén de TransMilenio que audita, **objeto por objeto**, qué se vuelve indistinguible para protan, deutan y tritan, contra qué fondo y con qué luz. WebGL2 + GLSL ES 3.00 + JavaScript puro. Sin frameworks. Sin build. Activos 100 % locales.

**Demo:** https://auditor-3d.vercel.app/

**Relación con el Proyecto 1 ([daltonizador-web](https://github.com/its-camilo/daltonizador-web)):** el P1 filtra una imagen plana: el color (y el contraste WCAG) cambia con la simulación, pero la escena es fija. Aquí la **luz es una variable**: azimut, elevación y espectro (D65, sodio, LED fría) alteran el Blinn-Phong antes de simular daltonismo, así que el mismo albedo puede pasar o fallar según el ángulo. La simulación Machado/Brettel se reutiliza casi sin cambios (`shaders/daltonizador.frag`, `uInputLinear = 1` sobre RGB lineal del FBO).

## Uso local

Sirve cualquier servidor estático sobre la raíz del repo (los shaders y los `.obj` se cargan con `fetch`):

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Verificación numérica de la teoría (mismo núcleo que el HUD):

```bash
node tools/teoria-conmutacion.js 1.0
```

Requisitos: navegador con **WebGL2** (Chrome, Brave, Firefox, Safari recientes). `EXT_color_buffer_float` mejora el buffer de color (RGBA16F); sin la extensión se usa RGBA8.

## Controles

| Acción | Control |
|--------|---------|
| Orbitar cámara | Arrastrar en el canvas |
| Zoom | Rueda del ratón |
| Seleccionar objeto para auditar | Clic en la escena |
| Deseleccionar | Segundo clic en el mismo objeto (escena o lista) |
| Vista original / simulada | Tecla **F** o selector «Vista» |
| Tipo y severidad | Selectores «Tipo» y «Severidad» |
| Luz | Azimut, elevación y preset (blanca / sodio / LED fría) |
| Marcas de accesibilidad | Tecla **H** o selector «Marcas»: contorno (defecto), patrón de relleno, apagadas |

Leyenda de marcas (no dependen solo del color, SC 1.4.1): rayas = no se distingue del fondo; doble línea = se confunde con otro objeto; punteado = WCAG < 3:1.

## Arquitectura

Tres pasadas por frame más trabajo en CPU cuando cambia el estado:

1. **Escena → FBO (MRT).** `shaders/escena.vert|frag`: Blinn-Phong en RGB lineal; salida 0 = color (RGBA16F si hay float buffer), salida 1 = ID de objeto (RGBA8).
2. **Daltonizador → pantalla.** Quad NDC con `shaders/daltonizador.vert|frag` del P1 (`uInputLinear`); vista original o simulada.
3. **Heatmap → blend.** `shaders/heatmap.frag` superpone contorno o patrón según el estado de cada figura.

**Picking:** `readPixels` de 1 px en el attachment de IDs.

**Auditoría (CPU):** al cambiar cámara, luz, tipo, severidad o albedo, `readPixels` de color e ID; promedio por objeto; anillo de fondo a 6 px en 8 direcciones; métricas con `js/audit-core.js` para los cuatro tipos. El HUD lista figuras ordenadas por peor caso y permite aplicar una sugerencia de color en OKLCH.

```
[ Escena 3D + Blinn-Phong ] ──MRT──► color + ID
         │                              │
         ▼                              ▼
[ Daltonizador P1 ]              [ readPixels → audit ]
         │
         ▼
[ Heatmap + HUD ]
```

## Métricas

- **ΔE en OKLab** entre color medio del objeto y fondo adyacente **en el espacio ya simulado**. Umbral provisional **τ = 0,08** (calibración pendiente con usuarios; un JND ronda 0,02).
- **WCAG 2.x** razón de luminancia relativa **3:1** (SC 1.4.11, criterio secundario de aviso).
- **APCA (WCAG 3):** solo discusión en `docs/revision-teorica.md`; no implementada en la app.

Estado por figura: *falla* si ΔE < τ; *aviso* si ΔE ≥ τ pero contraste < 3:1; *confusión entre objetos* si en visión normal ΔE ≥ 0,10 y en el tipo simulado ΔE < τ (pares de figuras).

Derivación paso a paso de los números del HUD: sección **4.1** de `docs/revision-teorica.md`.

## De la teoría al código

| Concepto | Código | Notas |
|---------|--------|--------|
| Simulación lineal RGB (Machado, Brettel) | `js/machado.js`, `shaders/daltonizador.frag` | Del P1; `uInputLinear` evita doble sRGB |
| Blinn-Phong | `shaders/escena.frag`, `blinnPhong()` en `js/audit-core.js` | Misma fórmula en GPU y CPU |
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
shaders/                  # GLSL ES 3.00 (escena, daltonizador, heatmap)
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

**Notas del profesor** (`docs/trabajo-pendiente.md`): multipass miopía/astigmatismo; separar y combinar shaders de afectaciones; marca del origen de la luz; explorar por qué los exámenes de miopía no usan pantallas de PC.

**Otros pendientes del avance:** calibrar colores con el Manual de Imagen TransMilenio; calibrar τ con usuarios; mapa de ángulos ciegos interactivo; prototipo «Ishihara 3D»; documento de requisitos estilo ASD-STE100.

## Referencias

Machado, Oliveira y Fernandes 2009; Brettel, Viénot y Mollon 1997; Blinn 1977; Ottosson 2020 (OKLab); WCAG 2.2 SC 1.4.1 y 1.4.11; Rong y Tan 2006 (JFA); Kuhn et al. 2008; Zhang et al. 2023 (Iris).
