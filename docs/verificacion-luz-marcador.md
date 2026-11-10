# Verificación: marcador 3D y sombreado sincronizados

## Fuente única de verdad

En cada frame, `render()` calcula una sola vez:

```js
const uLightPos = currentLightPos(); // A.lightPosFromAzEl(az, el, lightDist, target)
gl.uniform3fv(ps.loc.uLightPos, uLightPos);
// ...
drawLightMarker3D(vp, e, uLightPos, W, H);
```

`window.__lastLightPos` expone el mismo vector para pruebas automatizadas (comparado con `AUDIT.lightPosFromAzEl` leyendo los sliders).

## Secuencia «un slider a la vez» (SwiftShader)

Ejecutar: `node tools/capture-screenshots.mjs` (servidor estático en `:8765`).

| Captura | Cambio | uLightPos | Marcador (pantalla) | Iluminación lateral |
|---------|--------|-----------|---------------------|---------------------|
| `slider-baseline-az60-el35-dist7.png` | línea base | (4.97, 3.60, 2.27) | medio-centro | más brillante a la **izquierda** |
| `slider-only-az120.png` | solo az → 120° | (4.97, 3.60, **−3.00**) | sube y desplaza ~78 px vs anterior | gradiente pasa a **equilibrado** (luz desde otro lado) |
| `slider-only-el70.png` | solo el → 70° | (**2.07**, 3.60, 0.60) | más arriba (~672,176) | vuelve dominancia **izquierda** (luz más cenital) |
| `slider-only-dist4.png` | solo dist → 4 m | (2.84, 3.60, 1.04) | marcador acerca al centro 3D | escena algo más oscura (atenuación) |
| `slider-only-color-sodio.png` | solo color sodio | **igual que línea base** | misma región que baseline (posición 3D) | tinte cálido; **sin** mover la luz |

En las cinco tomas `sync uLightPos = sí` (deriva < 1e−4 entre uniforme y función de auditoría).

## Controles HUD

En `index.html`: slider **Distancia (m)** (`lightDist`, 2–12). Los eventos `input` y `change` marcan `state.dirty` para redibujar en el mismo frame.
