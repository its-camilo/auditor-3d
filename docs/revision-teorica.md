# Revisión teórica — Auditor 3D de accesibilidad cromática

Proyecto 2 · Computación Visual · Universidad Nacional de Colombia · Camilo Alejandro Lagos Malaver
Versión 1 · 3 de noviembre de 2026

## 0. Propósito

El profesor pidió una revisión teórica de la ceguera al color antes de avanzar con el Proyecto 2. También señaló el punto clave: si el objeto 3D solo se sombrea con un color, el problema es el mismo del Proyecto 1. Lo nuevo aparece cuando se sombrea con un modelo de iluminación. Este documento reúne la teoría necesaria y la conecta con la pregunta del proyecto:

> **¿Cuándo y desde dónde desaparece un objeto de una escena 3D para una persona con daltonismo, y qué color lo haría visible de nuevo?**

## 1. Visión del color normal

- **Tres conos.** La retina tiene conos L (onda larga, pico cerca de 560 nm), M (onda media, cerca de 530 nm) y S (onda corta, cerca de 420 nm). Cada cono integra el espectro que llega con su sensibilidad. Todo color percibido se reduce a tres números (L, M, S). Esto es la tricromacia.
- **Metamerismo.** Dos espectros distintos con el mismo (L, M, S) se ven iguales. Toda la simulación de daltonismo se apoya en este hecho.
- **Canales oponentes.** Después de los conos, el sistema visual codifica luminancia (L+M), rojo-verde (L−M) y azul-amarillo (S−(L+M)). Un dicrómata pierde un canal cromático, pero conserva casi intacto el canal de luminancia. Por eso la luminancia es su principal fuente de contraste.
- **Espacios usados en el proyecto.**
  - *sRGB lineal* (IEC 61966-2-1). Aquí se hacen la iluminación y la simulación, porque ambas son lineales en la luz.
  - *LMS* (Smith-Pokorny, Hunt-Pointer-Estévez). Es el espacio de los conos; las matrices de simulación se construyen en él.
  - *CIE XYZ*. Su componente Y es la luminancia relativa que usa WCAG: Y = 0.2126 R + 0.7152 G + 0.0722 B (en RGB lineal).
  - *OKLab* (Ottosson 2020). Es un espacio perceptualmente uniforme y barato de calcular. La distancia euclidiana ΔE_OK aproxima la diferencia percibida.

## 2. Deficiencias de la visión del color (CVD)

| Tipo | Cono afectado | Dicromacia | Tricromacia anómala | Confunde |
|---|---|---|---|---|
| Protan | L | Protanopía | Protanomalía | rojo–verde; el rojo se ve más oscuro |
| Deutan | M | Deuteranopía | Deuteranomalía (la más común) | rojo–verde; la luminancia casi no cambia |
| Tritan | S | Tritanopía | Tritanomalía (rara) | azul–amarillo |

- **Prevalencia.** Las formas rojo-verde están ligadas al cromosoma X. Afectan a cerca del 8 % de los hombres y al 0.5 % de las mujeres de ascendencia norte-europea. La tritan es mucho más rara.
- **Líneas de confusión.** Para un dicrómata, los colores que solo difieren en la dirección del cono faltante caen sobre la misma línea y se ven iguales. En el diagrama de cromaticidad todas convergen en un punto (copunto).
- **Severidad.** La tricromacia anómala no es "media dicromacia": el cono anómalo tiene su sensibilidad desplazada hacia la del otro cono. Machado et al. (2009) modelan ese desplazamiento con un parámetro de severidad de 0 a 1.

## 3. Modelos de simulación

| Modelo | Idea | Uso en el proyecto |
|---|---|---|
| **Brettel, Viénot y Mollon (1997)** | El dicrómata ve la proyección del color, a lo largo de la línea de confusión, sobre dos semiplanos anclados en los estímulos que se ven igual (475/575 nm o 485/660 nm) y en el blanco. | Tritan (los dos semiplanos se eligen con `step()` en el shader). |
| **Viénot, Brettel y Mollon (1999)** | Simplifica a un solo plano: una matriz 3×3 en RGB lineal. | Comparación (P1, `compare-models.js`). |
| **Machado, Oliveira y Fernandes (2009)** | Modelo fisiológico. Desplaza la sensibilidad espectral del cono anómalo y obtiene una matriz 3×3 por tipo y severidad. | Protan y deutan, severidad 0.0–1.0. Es el mismo modelo de Chrome DevTools y de Unreal Engine (`ColorDeficiency.ush`). |

**Dos propiedades que este proyecto aprovecha:**

1. **Linealidad.** Las tres simulaciones son lineales en RGB lineal (Brettel, por tramos). Para Machado: sim(x) = S·x.
2. **Conservación del blanco.** Cada fila de S suma 1, así que S·**1** = **1**. Un gris sigue siendo gris. En el código se verifica con un error máximo de 1×10⁻⁶ (protan, deutan) y 1×10⁻⁵ (tritan).

**Límites.** Una simulación no reproduce lo que siente una persona concreta. Es una herramienta de diseño, no un diagnóstico. El estudio "Why Should Red and Green Never Be Seen?" (PACM HCI, CHI PLAY 2023) muestra que los simuladores sí ayudan a desarrolladores con visión típica a encontrar problemas reales en juegos, aunque no los encuentran todos.

## 4. Contraste: qué mide cada métrica

- **WCAG 2.x.** CR = (Y₁ + 0.05)/(Y₂ + 0.05). Solo mira la luminancia. El SC 1.4.11 (contraste no textual) pide 3:1 entre un componente gráfico y sus *colores adyacentes*. El SC 1.4.1 prohíbe transmitir información solo con color.
- **Consecuencia importante.** WCAG por diseño no "ve" el croma. Datos del Proyecto 1 (`check-contrast.js`):
  - La lámina 12 tipo Ishihara da 1.47:1 en visión normal y 1.29:1 en deutan. Ya falla 3:1 sin simular, y aun así un tricrómata la lee por el croma.
  - El par rojo/verde #ff0000/#00c853 da 1.79:1 normal, **3.11:1 protan** y 1.34:1 deutan. En protan el contraste *sube*, porque el rojo se oscurece.
  - Por eso un mapa de calor de WCAG antes y después de simular no aísla el problema del daltónico.
- **ΔE en OKLab en el espacio simulado.** Mide si dos colores siguen siendo distinguibles para el observador simulado. Es la métrica principal del auditor. El umbral inicial es τ = 0.08 (provisional; un JND en OKLab está cerca de 0.02). Se calibra con usuarios.
- **APCA** (candidato para WCAG 3, Myndex). Corrige la asimetría entre polaridades y los colores oscuros de WCAG 2, pero está pensado sobre todo para texto. En el proyecto entra solo como discusión.

**Regla del auditor (v0):**
- *Falla* si ΔE_OK simulado < τ: el objeto no se distingue de su fondo.
- *Aviso* si ΔE_OK ≥ τ pero WCAG < 3:1 (incumple 1.4.11).
- *Bien* en otro caso.

## 5. Iluminación local

Modelo de Blinn-Phong (Blinn 1977) para un punto con albedo **k_d**, coeficiente especular k_s, exponente p, luz de color **L_c** e intensidad I:

  **I** = **k_d** ⊙ **L_c** · (k_a + I·max(n·l, 0)) + **L_c** · I·k_s·(n·h)^p

Se escribe como **I** = a · (**k_d** ⊙ **L_c**) + s · **L_c**, con dos escalares: a (ambiente + difuso) y s (especular). Ambos dependen de la geometría y de la luz, no del color.

## 6. Resultado central: iluminar y simular conmutan con luz blanca

**Proposición 1.** Sea S una matriz de simulación lineal con S·**1** = **1**, y sea la luz blanca (**L_c** = **1**). Entonces

  S·**I** = a · (S·**k_d**) + s · **1**,

es decir, simular la escena iluminada da lo mismo que iluminar un material ya simulado: sim(shade(c)) = shade(sim(c)).

*Demostración.* Con **L_c** = **1**, **I** = a·**k_d** + s·**1**. Por linealidad, S·**I** = a·S·**k_d** + s·S·**1** = a·S·**k_d** + s·**1**. ∎

**Excepciones.** (1) El clamp a [0, 1] no es lineal. (2) Brettel (tritan) es lineal por tramos: conmuta solo si **I** y **k_d** caen en el mismo semiplano. (3) Con luz de color, **k_d** ⊙ **L_c** no conmuta con S.

**Verificación numérica** (`tools/teoria-conmutacion.js`, 20 000 muestras al azar, severidad 1.0, protan y deutan):

| Luz | ΔE_OK medio | ΔE_OK máximo |
|---|---|---|
| Blanca D65 | 0.0000 | 0.0000 |
| LED fría (aprox.) | 0.0076 | 0.0233 |
| Sodio, noche (aprox.) | 0.0415 | 0.1274 |

Con luz de sodio, el error medio ya es la mitad del umbral τ. El color de la luz cambia por sí mismo lo que el daltónico distingue. Esto justifica auditar la escena renderizada y no solo la paleta de materiales.

**Consecuencias para la implementación.**
- El promedio de color de un objeto se puede simular después de promediar: sim(promedio) = promedio(sim) en Machado. Por eso basta con leer el buffer de color una vez y calcular los tres tipos en CPU.
- La sugerencia de color puede predecir el render del nuevo albedo sin volver a dibujar: render' = render ⊙ (k_d'/k_d) en el término difuso.

**Corolario 1 (cuándo importa el ángulo de la luz).** Sean un objeto y su fondo, sin especular.
- *Misma normal* (un letrero sobre una pared): ambos reciben el mismo a. La razón de luminancias Y_obj/Y_fondo = Y(S·k_d,obj)/Y(S·k_d,fondo) es constante. El ángulo solo aclara u oscurece toda la escena; el contraste WCAG cambia únicamente por el término +0.05.
- *Normales distintas* (el costado de un bus frente a la pared del fondo): a_obj ≠ a_fondo, y la razón a_obj·Y(S·k_d,obj)/(a_fondo·Y(S·k_d,fondo)) barre un rango con el ángulo. Si el rango contiene 1, hay un ángulo de **isoluminancia** θ\*. Allí el dicrómata, que perdió el canal cromático que separaba el par, solo puede separarlos por el croma que le queda en su plano (un solo eje, azul–amarillo, para protan y deutan). Si ese croma también coincide, el objeto desaparece.

**Ángulo ciego en la escena v0** (barrido de azimut −90° a 90° y elevación 5° a 85°, severidad 1.0):

| Par | Tipo | ΔE_OK mínimo | Ángulo (az, el) | WCAG allí | Y_obj/Y_fondo | Lectura |
|---|---|---|---|---|---|---|
| Botón rojo / panel verde | deutan | 0.031 | falla en todo el barrido | 1.05:1 | 1.02–1.23 | Falla por color (problema del P1) |
| Botón rojo / panel verde | protan | 0.050 | (0°, 5°) | 1.20:1 | 0.46–0.80 | Falla por color |
| Bus rojo / pared | deutan | 0.101 | (90°, 30°) | 1.07:1 | 0.04–**1.01** | Casi isoluminante con luz lateral: falla por luz (problema del P2) |
| Banca azul / piso | deutan | 0.165 | (0°, 5°) | 1.69:1 | 0.29 constante | Misma normal: la razón no cambia |

En deutan, el botón falla con cualquier posición de la luz (ΔE_OK entre 0.031 y 0.051). El bus solo se acerca a la falla con cierta posición de la luz (ΔE_OK de 0.101 a 0.582 según el ángulo). Esa diferencia es exactamente lo que el Proyecto 1 no podía mostrar.

## 7. Trabajos previos y el hueco

| Trabajo | Qué hace | Qué le falta frente al Auditor 3D |
|---|---|---|
| Chrome/Edge DevTools, Sim Daltonism, Color Oracle | Filtran la pantalla | No saben qué es un objeto |
| Unreal Engine (CVD preview y corrección), Ubisoft Chroma | Filtran el juego en vivo | Igual: filtro de imagen, sin métrica por objeto |
| InclusivityXR (Woods et al., CVMP 2023) | Detecta problemas de inclusión en AR/VR desde video, con visión por computador | Infiere los objetos; no usa la escena ni la luz |
| Iris (Zhang et al., ESEC/FSE 2023) | Repara automáticamente colores de apps Android según el contexto | 2D, sin iluminación |
| Kuhn, Oliveira y Fernandes (TVCG 2008); Machado y Oliveira (EuroVis 2010) | Recoloreo que preserva la naturalidad / realce en tiempo real | Imagen, no escena |
| SeeingVR (CHI 2019), BlueVR (CHI PLAY 2023), Szczurowski y Smith (2018) | Accesibilidad y empatía en VR | Simulan; no auditan objeto por objeto |

**Hueco.** Ninguno usa la información que solo tiene el motor gráfico: qué píxel es de qué objeto, cuál es su fondo real en pantalla y cómo la luz cambia su contraste. El Auditor 3D usa el buffer de IDs, el render a textura y el modelo de iluminación para responder *qué objeto falla, contra qué fondo, para qué tipo y con qué luz*.

## 8. Técnicas de render que se aplican

- **Render to Texture + MRT.** Una sola pasada escribe el color lineal (RGBA16F) y el ID del objeto (RGBA8) con `drawBuffers`.
- **Picking por color.** Cada objeto escribe su ID; un `readPixels` de 1 px dice qué se tocó.
- **Ping-Pong / Jump Flooding** (Rong y Tan, I3D 2006). En log₂(N) pasadas propaga, para cada píxel, el borde más cercano de otro objeto. Da el "anillo de fondo adyacente" que pide WCAG 1.4.11 en GPU (v0 lo hace en CPU).
- **HUD sin depender del color.** Rayas para "falla", puntos para "aviso", iconos y texto (SC 1.4.1, Game Accessibility Guidelines).

## 9. Preguntas de investigación

1. ¿Qué tan bien predice el modelo analítico (Proposición 1 y Corolario 1) el ángulo ciego que mide la GPU?
2. ¿Cuántos objetos de una escena urbana real pasan con luz de día y fallan con luz de sodio, y para qué tipo?
3. ¿Coincide el veredicto del auditor con lo que reportan personas con CVD? (Sirve para calibrar τ.)
4. ¿Puede una figura "esconderse" solo para dicrómatas con cierta luz? (Base de un test tipo Ishihara 3D, puente al Proyecto 3.)

## Referencias

- Blinn, J. F. (1977). Models of light reflection for computer synthesized pictures. *SIGGRAPH '77*.
- Brettel, H., Viénot, F., Mollon, J. D. (1997). Computerized simulation of color appearance for dichromats. *JOSA A* 14(10).
- Viénot, F., Brettel, H., Mollon, J. D. (1999). Digital video colourmaps for checking the legibility of displays by dichromats. *Color Research & Application* 24(4).
- Machado, G. M., Oliveira, M. M., Fernandes, L. A. F. (2009). A physiologically-based model for simulation of color vision deficiency. *IEEE TVCG* 15(6).
- Machado, G. M., Oliveira, M. M. (2010). Real-time temporal-coherent color contrast enhancement for dichromats. *EuroVis*.
- Kuhn, G. R., Oliveira, M. M., Fernandes, L. A. F. (2008). An efficient naturalness-preserving image-recoloring method for dichromats. *IEEE TVCG* 14(6).
- Ottosson, B. (2020). A perceptual color space for image processing (OKLab).
- W3C (2023). WCAG 2.2, SC 1.4.1 y 1.4.11, y Understanding 1.4.11.
- Somers, A. (Myndex). APCA — Accessible Perceptual Contrast Algorithm, documentación.
- Rong, G., Tan, T.-S. (2006). Jump flooding in GPU with applications to Voronoi diagram and distance transform. *I3D*.
- Zhang, Y. et al. (2023). Automated and context-aware repair of color-related accessibility issues for Android apps (Iris). *ESEC/FSE*.
- Woods et al. (2023). InclusivityXR — an online tool for detecting inclusivity issues in AR and VR. *CVMP*.
- Why should red and green never be seen? Exploring color blindness simulations as tools to create chromatically accessible games (2023). *Proc. ACM HCI (CHI PLAY)*.
- Zhao, Y. et al. (2019). SeeingVR. *CHI*.
- BlueVR (2023). *CHI PLAY*.
- Szczurowski, K., Smith, M. (2018). Emulating perceptual experience of color vision deficiency with virtual reality.
- Game Accessibility Guidelines. Ensure no essential information is conveyed by a fixed colour alone.
- Akenine-Möller, T. et al. *Real-Time Rendering*, 4.ª ed. (cuaderno Visual).
- TransMilenio S.A. (2023). Manual de Imagen y Normas Gráficas, v4.
