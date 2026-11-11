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

**Valores por defecto de luz:** azimut 60°, elevación 35°, **distancia 4 m**.

## Secuencia «un slider a la vez» (SwiftShader)

Ejecutar: `node tools/capture-screenshots.mjs` (servidor estático en `:8765`).

| Captura | Cambio | uLightPos (aprox.) | Marcador (pantalla) | Iluminación lateral |
|---------|--------|--------------------|---------------------|---------------------|
| `slider-baseline-az60-el35-dist4.png` | línea base | (2.84, **3.69**, 1.04) | círculo amarillo 3D (`marcaluz` únicamente) | depende del azimut |
| `slider-only-az120.png` | solo az → 120° | (2.84, 3.69, −2.24) | desplaza en pantalla | gradiente rota |
| `slider-only-el70.png` | solo el → 70° | (1.18, 5.16, 0.08) | más alto en pantalla | luz más cenital |
| `slider-only-dist9.png` | solo dist → 9 m | más lejos del target | marcador en el volumen del andén | atenuación más suave |
| `slider-only-color-sodio.png` | solo color sodio | **igual que línea base** | misma posición 3D | tinte cálido |

En las cinco tomas `sync uLightPos = sí` (deriva < 1e−4 entre uniforme y función de auditoría).

## Controles HUD

En `index.html`: slider **Distancia (m)** (`lightDist`, 2–12, **defecto 4**). Los eventos `input` y `change` marcan `state.dirty` para redibujar en el mismo frame.

No existe indicador 2D en el borde (`luzhud.frag` eliminado). Si la proyección del centro de `uLightPos` cae fuera del frustum (|NDC| > 1), no se dibuja marca.

**Nota sobre az 0°, el 85°, 12 m:** la posición geométrica queda en **Y ≈ 13,35 m** (NDC **y ≈ 3,92**); antes un tope artificial **Y ≤ 3,6 m** en `lightPosFromAzEl` acercaba la luz al muro y generaba una marca falsa. Ese tope se eliminó en `737d4e4`; iluminación y `marcaluz` usan la misma `uLightPos`.

**Origen del clamp Y (PR #1):** heurística para mantener la fuente dentro del volumen cubierto del andén (~techo del modelo), no una restricción física.

**Regresión HUD `807c82b` → `737d4e4`** (`node tools/hud-audit-snapshot.mjs`, servidor sirviendo el commit bajo prueba):

| Escenario | X de 18 | Pares | ΔE botón (807 → 737) |
|-----------|---------|-------|----------------------|
| default / deutan D65 | 3 | 16 | 0,0408 → 0,0404 |
| daltonismo apagado D65 | 0 | 0 | 0,2034 → 0,2033 |
| daltonismo apagado sodio | 0 | 0 | 0,1918 → 0,1921 |
| deutan + miopía óptica→color | 16 | 30 | 0,00742 → 0,00736 |
| deutan + miopía color→óptica | 16 | 30 | 0,00742 → 0,00736 |
