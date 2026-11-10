# Auditor 3D de accesibilidad cromática — v0

Escena 3D (andén de TransMilenio) que dice, objeto por objeto, qué se vuelve indistinguible para protan, deutan y tritan, contra qué fondo y con qué luz. WebGL2 + GLSL ES 3.00 + JavaScript puro. Sin frameworks. Sin build.

Demo: https://auditor-3d.vercel.app/

## Estructura

- `index.html`, `style.css`: canvas y HUD accesible (texto grande, alto contraste, nada solo por color).
- `main.js`: host WebGL2. FBO con MRT (color RGBA16F + ID RGBA8), 3 pasadas, auditoría, picking, controles.
- `audit-core.js`: núcleo matemático compartido por navegador y node: sRGB, WCAG, OKLab/OKLCH, simulación, Blinn-Phong, métricas, sugerencia.
- `scene.js`: objetos (cajas), materiales, fondo previsto y luces de prueba.
- `machado.js`: matrices Machado 2009 y Brettel 1997 (sin cambios desde el Proyecto 1).
- `shaders/escena.vert|frag`: pasada 1, Blinn-Phong con dos salidas.
- `shaders/daltonizador.vert|frag`: pasada 2, del Proyecto 1. Único cambio: `uInputLinear`.
- `shaders/heatmap.frag`: pasada 3, mapa de calor por objeto y contorno de selección.
- `tools/teoria-conmutacion.js`: verificación de la Proposición 1 y mapa de ángulos ciegos.
- `docs/`: revisión teórica, avance 1 y salida de la herramienta.

## Uso

```bash
python3 -m http.server 8000   # abre http://localhost:8000
node tools/teoria-conmutacion.js 1.0
```

Controles: arrastrar = orbitar · rueda = zoom · clic = auditar objeto · F = original/simulada · H = mapa de calor.

## Referencias

Machado, Oliveira y Fernandes 2009; Brettel, Viénot y Mollon 1997; Blinn 1977; Ottosson 2020 (OKLab); WCAG 2.2 SC 1.4.1 y 1.4.11; Rong y Tan 2006 (JFA); Kuhn et al. 2008; Zhang et al. 2023 (Iris).
