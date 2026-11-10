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

## Auditoría y picking

- **Picking e IDs del heatmap:** siempre el buffer de la pasada de escena, **sin desenfoque**.
- **ΔE / WCAG:** si hay etapas ópticas activas, los promedios de color se leen del buffer **después del desenfoque** y **antes** del daltonismo; el daltonismo sigue evaluándose en CPU sobre ese color (el desenfoque puede fusionar objeto y fondo y bajar contraste).

## Límite clínico (pantalla vs examen)

Esta aplicación **simula cómo vería un miope la escena 3D**, no mide la miopía del usuario. Un monitor a ~60 cm suele quedar dentro del rango nítido de un miope moderado y la **acomodación** cambia el enfoque; por eso los exámenes clínicos usan cartas calibradas a ~6 m. Ver también `docs/trabajo-pendiente.md` (notas del profesor).
