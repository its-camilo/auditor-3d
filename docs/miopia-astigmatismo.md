# Miopía y astigmatismo en el pipe multipass

El Auditor 3D encadena etapas de postproceso en **ping-pong** (véase [Pipe](https://vcnotebook.gitlab.io/docs/imaging/pipe/) y [DOF](https://vcnotebook.gitlab.io/docs/imaging/dof/)): la escena se renderiza una vez en un FBO con color lineal, buffer de IDs y **profundidad**; cada etapa habilitada lee `uSource` y escribe en el otro buffer de un par A/B. El mapa de profundidad permanece fijado como `uDepth` para las etapas ópticas.

## Escala y profundidad

La escena TransMilenio usa **1 unidad de mundo ≈ 1 metro**. La cámara tiene `near = 0,1 m`, `far = 100 m` y FOV vertical 50°. La profundidad del buffer se linealiza a distancia al plano de la cámara con la fórmula estándar de perspectiva WebGL.

## Miopía (`shaders/miopia.frag`)

Parametrización en **dioptrías** (magnitud |D|, p. ej. 3 D) y **diámetro pupilar** (3–6 mm):

- **Punto lejano** (donde aún ve nítido): \(f_\text{far} = 1 / |D|\) metros.
- Objetos **más cercanos** que \(f_\text{far}\) permanecen nítidos; más lejanos se desenfocan.
- **Defocus** en el objeto a distancia \(d\): \(\max(0,\ |D| - 1/d)\).
- El **radio de desenfoque en píxeles** escala con pupila × defocus y con el FOV vertical (ángulo de mancha ≈ pupila × defocus, proyectado al viewport).

El gather es una **espiral** de muestras (estilo circle of confusion del notebook) con la prueba de admisión: aceptar muestras más lejanas en profundidad o con CoC mayor que la distancia en la espiral, para que un primer plano nítido no se contamine con fondo borroso.

## Astigmatismo (`shaders/astigmatismo.frag`)

**Cilindro** (dioptrías) y **eje** (0–180°): el kernel es **anisotrópico** (mayor along el meridiano del eje, débil en el ortogonal). Usa la misma profundidad para modular la fuerza con la distancia.

## Daltonismo (`shaders/daltonismo.frag`)

Reutiliza la simulación del Proyecto 1. `uOutputLinear = 1` si hay otra etapa después; `0` si es la última (sRGB en pantalla).

## Orden de composición

Por defecto: **óptica → color** (primero la imagen retinal borrosa, luego la simulación de conos). La opción **color → óptica** intercambia el orden; el resultado **no conmuta** (como en el capítulo Pipe).

## Luz puntual y marcador 3D

La iluminación de escena usa **Blinn–Phong con luz puntual** en `uLightPos` (mismo vector que `audit-core.js`):

- Dirección en cada fragmento: `L = normalize(uLightPos - vWorld)`.
- Atenuación inversa cuadrática suavizada: `1 / (1 + k·d²)` con `k = 0,035` (`LIGHT_ATTEN_K`).
- Azimut, elevación y **distancia** (2–12 m) definen la posición dentro del volumen del andén (`lightPosFromAzEl`).
- El marcador billboard (`shaders/marcaluz.*`) se dibuja en **la misma posición** que el uniforme de la pasada de escena; no hay copia cacheada en otro estado. Cada cambio de slider dispara `render()` y actualiza sombreado y marcador en el mismo frame.
- Si la luz queda fuera del frustum o detrás de la cámara, el fallback 2D (`luzhud.frag`) indica el azimut en el borde del canvas.

## Auditoría y picking

- **Picking e IDs del heatmap:** siempre el buffer de la pasada de escena, **sin desenfoque**.
- **ΔE / WCAG:** con orden **óptica→color**, el tap de auditoría queda tras el desenfoque y **antes** del daltonismo (simulación Machado en CPU). Con **color→óptica** y ambas etapas activas, el tap es **tras** toda la cadena (colores ya daltonizados en GPU; no se vuelve a aplicar Machado para el tipo activo). Las confusiones entre objetos del HUD solo se cuentan con daltonismo encendido.

## Límite clínico (pantalla vs examen)

Esta aplicación **simula cómo vería un miope la escena 3D**, no mide la miopía del usuario. Un monitor a ~60 cm suele quedar dentro del rango nítido de un miope moderado y la **acomodación** cambia el enfoque; por eso los exámenes clínicos usan cartas calibradas a ~6 m. Ver también `docs/trabajo-pendiente.md` (notas del profesor).
