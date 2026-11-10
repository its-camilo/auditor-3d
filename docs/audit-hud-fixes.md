# Correcciones de auditoría (confusiones y pipe color→óptica)

## 1. Pares confundidos con daltonismo apagado

**Causa:** `computeConfusions()` siempre aplicaba `A.simulate(state.type, …)` aunque `enDalton` estuviera en falso; el resumen usaba `conditionLabel()` → «sin condiciones» pero seguía contando pares dicrómatas.

**Decisión:** Las confusiones entre objetos solo tienen sentido cuando la vista simulada incluye daltonismo (comparar si dos figuras serían indistinguibles para el tipo activo). Sin daltonismo, el conteo de pares es **0**. Si solo hay óptica activa, la etiqueta describe la miopía/astigmatismo y los pares siguen en 0 (no es una prueba de confusión cromática entre objetos).

## 2. Doble Machado en color→óptica

**Causa:** Con **color→óptica** y miopía (o astigmatismo), `texAuditSrc` apunta al color **después** de daltonismo en GPU y del desenfoque, pero `pairMetrics()` volvía a llamar `simulate(type, …)` en CPU.

**Corrección:** `daltonAlreadyInAuditBuffer()` detecta ese caso; `pairMetrics(obj, bg, sev, skipSimulateType)` y `computeConfusions()` omiten la segunda simulación para el tipo activo. Con **óptica→color** el tap sigue siendo pre-daltonismo y Machado se aplica una sola vez en CPU (sin cambio).

Verificación: `node tools/hud-audit-snapshot.mjs`.
