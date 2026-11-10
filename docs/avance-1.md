# Avance 1 — Auditor 3D (prototipo v0)

Proyecto 2 · Computación Visual · Camilo Alejandro Lagos Malaver · 3 de noviembre de 2026

Demo: https://auditor-3d.vercel.app/
Código: carpeta "prototipo-v0" en esta misma carpeta de Drive (WebGL2 + GLSL ES 3.00 + JavaScript puro, sin frameworks, igual que el Proyecto 1).

## 1. Qué se hizo

Se siguió el mismo camino del Proyecto 1: primero la teoría (documento "Revisión teórica — Auditor 3D") y luego un código que la implementa línea por línea. La teoría y la aplicación comparten el mismo núcleo matemático (`audit-core.js`). La prueba numérica corre exactamente el código que usa el HUD.

## 2. De la teoría a la implementación

| Concepto teórico | Dónde vive en el código | Evidencia |
|---|---|---|
| Simulación lineal en RGB lineal (Machado 2009, Brettel 1997) | `machado.js` y `shaders/daltonizador.frag`, reutilizados del Proyecto 1 | Único cambio en el `.frag`: el uniform `uInputLinear` para no decodificar sRGB dos veces |
| Conservación del blanco, S·1 = 1 | `tools/teoria-conmutacion.js`, parte 1 | Error máximo 1×10⁻⁶ (protan, deutan) y 1×10⁻⁵ (tritan) |
| Blinn-Phong I = a·k_d⊙L_c + s·L_c | `shaders/escena.frag` y `blinnPhong()` en `audit-core.js` (misma fórmula) | Mismo modelo en GPU y en CPU |
| Proposición 1: sim(shade(c)) = shade(sim(c)) con luz blanca | `tools/teoria-conmutacion.js`, parte 2 | ΔE_OK 0.0000 con luz blanca; 0.0415 de media y 0.1274 de máximo con sodio |
| Corolario 1: el ángulo importa solo si cambia la razón de luminancias | `tools/teoria-conmutacion.js`, parte 3 | Banca/piso: razón constante 0.29. Bus/pared (deutan): de 0.04 a 1.01, cruza la isoluminancia |
| Linealidad: sim(promedio) = promedio(sim) | `runAudit()` en `main.js` | Una sola lectura del buffer de color da los tres tipos |
| Fondo adyacente (WCAG 1.4.11) | Anillo a 6 px alrededor de cada objeto con el buffer de IDs (`runAudit()`) | v1: Jump Flooding en GPU (ping-pong) |
| ΔE_OK en espacio simulado + WCAG 3:1 | `pairMetrics()` y `status()` | Umbral τ = 0.08 provisional |
| No transmitir información solo con color (SC 1.4.1) | `shaders/heatmap.frag`, `style.css` | Rayas = falla, puntos = aviso, iconos y texto en el HUD |
| Sugerencia que preserva el tono (Kuhn 2008, Iris 2023) | `suggest()` en OKLCH | Botón rojo con luz frontal (az 0°, el 40°): sugiere #320102; pasa de 1.10:1 y ΔE 0.049 (deutan) a 3.03:1 y ΔE 0.304 |

## 3. Pipeline implementado

1. **Pasada 1 (Local Lighting + RTT + MRT).** Escena de cajas → FBO con dos salidas: color lineal RGBA16F e ID RGBA8.
2. **Pasada 2 (Color).** Quad NDC con el `daltonizador.frag` del Proyecto 1 → pantalla. Vista original o simulada (tecla F).
3. **Pasada 3 (HUD/Visualization).** Quad NDC con `heatmap.frag` y mezcla alfa: patrón por estado y contorno del objeto seleccionado (tecla H).
4. **Auditoría.** Cuando cambia algo (cámara, luz, tipo, material): `readPixels` de color e ID, promedio por objeto y anillo de fondo, métricas en los cuatro tipos de visión.
5. **Picking.** Clic → `readPixels` de 1 px en el buffer de IDs → detalle en el HUD con tabla, sugerencia y botón "Aplicar".

## 4. Escena v0

Andén de TransMilenio hecho con cajas: piso, pared, franja podotáctil amarilla, señales troncales roja y verde, panel de ayuda verde con botón de emergencia rojo, bus troncal rojo y banca azul. Luces: blanca D65, sodio (noche) y LED fría. Los colores son aproximados; falta calibrarlos con el Manual de Imagen de TransMilenio (v4, 2023).

## 5. Primeros resultados (severidad 1.0)

- **Falla por color (problema del P1):** el botón rojo sobre el panel verde. En deutan, ΔE_OK entre 0.031 y 0.051 con cualquier luz.
- **Falla por luz (problema nuevo del P2):** el bus rojo contra la pared. En deutan la razón de luminancias va de 0.04 a 1.01 según el ángulo. Con luz lateral (az 90°, el 30°) el contraste baja a 1.07:1 y ΔE_OK a 0.101, justo encima del umbral.
- **Luz de color:** con sodio, simular antes o después de iluminar difiere en promedio ΔE_OK 0.0415. Hay que auditar la imagen renderizada.

## 6. Pendientes (siguiente avance)

1. Jump Flooding en GPU (ping-pong) para el anillo de fondo; medir ms frente a la versión CPU.
2. Mapa de ángulos ciegos en la app: barrido automático de la luz y gráfica θ predicho vs. θ medido.
3. Calibrar colores con el manual de TransMilenio y modelos más ricos que cajas (señal con texto, mapa de rutas).
4. Calibrar τ con un grupo de prueba (como se calibró el umbral de $Q en el P1).
5. Prototipo del test "Ishihara 3D": figura que se esconde para dicrómatas con cierta luz.
6. Documento de requisitos al estilo ASD-STE100, como en el Proyecto 1.

## 7. Cómo ejecutar

```
python3 -m http.server 8000      # dentro de la carpeta del prototipo
# abrir http://localhost:8000
node tools/teoria-conmutacion.js 1.0   # verificación numérica de la teoría
```
