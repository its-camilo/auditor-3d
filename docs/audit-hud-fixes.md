# Correcciones de auditoría (confusiones y pipe color→óptica)

## 1. Pares confundidos con daltonismo apagado

**Causa:** `computeConfusions()` siempre aplicaba `A.simulate(state.type, …)` aunque `enDalton` estuviera en falso; el resumen usaba `conditionLabel()` → «sin condiciones» pero seguía contando pares dicrómatas.

**Decisión:** Las confusiones entre objetos solo tienen sentido cuando la vista simulada incluye daltonismo (comparar si dos figuras serían indistinguibles para el tipo activo). Sin daltonismo, el conteo de pares es **0**. Si solo hay óptica activa, la etiqueta describe la miopía/astigmatismo y los pares siguen en 0 (no es una prueba de confusión cromática entre objetos).

## 1b. Marcas de heatmap desincronizadas

**Causa:** al cambiar casillas (p. ej. apagar daltonismo) se llamaba `uploadStatus()` sin volver a ejecutar `runAudit()`, dejando texturas y datos viejos mientras el resumen se recalculaba con `metricsIndex()` distinto.

**Corrección:** `scheduleAudit()` fuerza una pasada completa; `figureStatus()` es la única fuente para resumen, lista y textura de estado; el heatmap no pinta fallas si el resumen dice 0.

## 2. Doble Machado en color→óptica

**Causa:** Con **color→óptica** y miopía (o astigmatismo), `texAuditSrc` apunta al color **después** de daltonismo en GPU y del desenfoque, pero `pairMetrics()` volvía a llamar `simulate(type, …)` en CPU.

**Corrección:** `daltonAlreadyInAuditBuffer()` detecta ese caso; `pairMetrics(obj, bg, sev, skipSimulateType)` y `computeConfusions()` omiten la segunda simulación para el tipo activo. Con **óptica→color** el tap sigue siendo pre-daltonismo y Machado se aplica una sola vez en CPU (sin cambio).

## 2b. Pares confundidos: 0 en color→óptica

**Causa:** `dEn` comparaba colores del tap de auditoría (a veces ya daltonizados), no la escena lineal. Muchos pares parecían «ya confundidos en normal» y se descartaban.

**Corrección:** `objScene` / `bgScene` desde el FBO de escena (pre-pipe). `dEn` usa escena; `dE` usa el tap de vista (`obj` / `obj` simulado en CPU cuando aplica). El conteo de pares no depende del orden del pipe salvo la no conmutación real óptica↔color (los números pueden diferir levemente por el desenfoque, no caer a 0).

Verificación: `node tools/hud-audit-snapshot.mjs`.
