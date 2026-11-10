# Auditor 3D explicado fácil

Este documento explica el Auditor 3D sin suponer que sabes de gráficos por computador. Si quieres las fórmulas y la teoría completa, mira el documento "Revisión teórica - Auditor 3D".

## 1. La idea en una frase

El programa dibuja un andén de TransMilenio en 3D y te dice qué objetos dejaría de ver bien una persona con daltonismo, y si eso pasa por culpa del color o por culpa de la luz.

## 2. Las piezas del programa

Piensa en el programa como una cocina:

- **La receta** es JavaScript (main.js). Decide qué se dibuja, dónde está la cámara y dónde está la luz. También lee los resultados y llena el panel de la derecha.

- **Los cocineros** son los shaders. Son programas pequeños que corren en la tarjeta de video (la GPU). La GPU tiene miles de núcleos y cada uno calcula un píxel al mismo tiempo. Por eso la escena corre a unos 60 cuadros por segundo.

- **Los ingredientes** son los modelos 3D (carpeta models/) y la tabla de objetos (scene.js), que dice de qué color es cada cosa y qué tan brillante es.

Reglas del curso que se cumplen: WebGL2, shaders en GLSL ES 3.00, JavaScript puro, sin Three.js ni otras librerías, y todo local (nada se descarga de internet al correr).

## 3. ¿Qué es un shader?

Un shader es una función que la GPU ejecuta muchas veces. Hay dos tipos:

- **Vertex shader (de vértices).** Recibe cada punto (vértice) de un modelo 3D y calcula en qué lugar de la pantalla cae. Es como decidir dónde va cada esquina del dibujo.

- **Fragment shader (de fragmentos o píxeles).** Recibe cada píxel que cubre un objeto y decide de qué color se pinta. Es como pintar el dibujo por dentro.

## 4. Los shaders que usa el Auditor 3D

Cada cuadro de la pantalla se hace en tres pasadas, una detrás de otra.

**Pasada 1: dibujar la escena con luz** (escena.vert y escena.frag)

- escena.vert ubica cada vértice de los modelos en la pantalla según la cámara.

- escena.frag calcula el color de cada píxel con la luz (ver sección 6).

- Este shader escribe dos imágenes a la vez (técnica MRT, "múltiples salidas"):

  1.  Una imagen con el color real de cada píxel.

  2.  Una imagen invisible con un número por píxel que dice a qué objeto pertenece (1 = piso, 19 = botón, 20 = bus...). Sirve para saber qué objeto tocaste con el mouse y para medir cada objeto por separado.

**Pasada 2: simular el daltonismo** (daltonizador.vert y daltonizador.frag)

- Es el mismo shader del Proyecto 1. Toma la imagen de color y la transforma en lo que vería una persona con protanopia, deuteranopia o tritanopia.

- Solo se le agregó un interruptor (uInputLinear) porque ahora la imagen ya llega en "color lineal" (sección 7).

**Pasada 3: marcar los problemas** (heatmap.frag)

- Dibuja encima los contornos que avisan qué objeto falla.

- Rayas negras y blancas = el objeto no se distingue de su fondo.

- Doble línea blanca = el objeto se confunde con otro objeto (por ejemplo, dos rutas del mapa).

- Punteado = el contraste es bajo según WCAG (menos de 3:1).

- Contorno amarillo = el objeto que seleccionaste.

- Las marcas usan forma (rayas, puntos, líneas) y no color, para que una persona daltónica también las entienda.

**La medición** no es un shader: después de dibujar, JavaScript lee las dos imágenes de la pasada 1 y calcula los números del panel (ΔE y contraste).

## 5. Cómo se hicieron los modelos 3D

- Un modelo 3D es una lista de triángulos. Cada triángulo tiene 3 puntos en el espacio (x, y, z) y una "normal" en cada punto: una flecha que dice hacia dónde mira la superficie. La normal es clave para la luz.

- Los modelos se generan con un programa en Python (tools/generar-modelos.py). No se dibujaron a mano. El programa arma figuras con piezas simples:

  - **Cajas redondeadas**: carrocería del bus, señales, panel de ayuda, banca. Las esquinas redondeadas hacen que la luz cambie suave en los bordes, como en la vida real.

  - **Cilindros y prismas**: columnas, ruedas, botón de emergencia y los marcadores del mapa (círculo, cuadrado, triángulo, rombo, hexágono).

  - **Domos**: 732 medias esferas pequeñas forman la franja podotáctil amarilla del piso.

  - **Letras de píxeles**: la H y la B de las señales se arman con cajitas, como una letra de videojuego antiguo.

<!-- -->

- Total: unos 24 000 triángulos.

- El programa guarda todo en archivos **OBJ**, un formato de texto que entienden Blender y casi cualquier programa 3D. Se llaman anden.obj, senales.obj, bus.obj y banca.obj.

- La página web los lee con un lector propio (obj.js), porque el curso no permite librerías.

- Si en el futuro se hace un modelo mejor en Blender, se exporta como OBJ (adelante −Z, arriba Y, con normales y triangulado) y se le pone el mismo nombre de objeto que dice scene.js. El programa lo carga sin cambiar el código.

## 6. Cómo se maneja la luz

Se usa el modelo de iluminación **Blinn-Phong**, uno de los más usados en gráficos por computador. El color de cada píxel es la suma de tres partes:

1.  **Luz ambiente.** Una luz de relleno que llega a todo por igual, para que nada quede negro del todo. Vale 0.2.

2.  **Luz difusa.** La cara que mira hacia la luz se ve más clara y la que mira hacia otro lado se ve más oscura. Depende del ángulo entre la normal de la superficie y la dirección de la luz. Por eso el costado del bus cambia de claridad cuando mueves la luz.

3.  **Brillo especular.** El reflejo brillante que se ve en una superficie lisa, como la lámina del bus o el botón. Depende también de dónde está la cámara.

Controles de la luz en el panel:

- **Azimut**: gira la luz alrededor de la escena (como el sol durante el día).

- **Elevación**: sube o baja la luz (sol alto a mediodía, sol bajo al atardecer).

- **Color de la luz**: blanca (de día), sodio (amarilla, como el alumbrado público de noche) o LED fría (un poco azulada).

**Lo nuevo frente al Proyecto 1.** Con luz blanca, simular el daltonismo antes o después de iluminar da lo mismo. Pero con luz de color (por ejemplo, sodio) ya no da lo mismo. Además, la luz puede hacer que un objeto quede casi igual de claro que su fondo y "desaparezca" solo en ciertos ángulos. Eso no se puede ver en una imagen plana, solo en 3D.

## 7. Cómo se maneja el color

- **sRGB y color lineal.** Los colores que escribimos, como \#c62828, están en sRGB, un formato pensado para pantallas que guarda más detalle en los tonos oscuros. Pero la luz se suma de forma "lineal" (dos lámparas iguales dan el doble de luz). Por eso el programa convierte cada color de sRGB a lineal, hace todas las cuentas de luz y simulación ahí, y al final lo vuelve a convertir a sRGB para la pantalla. Se usa la fórmula exacta del estándar sRGB, no la aproximación "gamma 2.2".

- **Simulación del daltonismo.** Es una matriz de 3 × 3 (nueve números) que mezcla el rojo, el verde y el azul. Por ejemplo, en deuteranopia se pierde la diferencia entre rojo y verde. Se usa el modelo de Machado, Oliveira y Fernandes (2009) para protan y deutan, y el de Brettel, Viénot y Mollon (1997) para tritan. La severidad va de 0 (visión normal) a 1 (dicromacia completa).

- **ΔE en OKLab (el número principal).** OKLab es un espacio de color hecho para que las distancias se parezcan a lo que percibe el ojo. ΔE es la distancia entre el color del objeto y el de su fondo, ya simulados. Si es menor que 0.08, el auditor dice que el objeto no se distingue. Como referencia, 0.02 es apenas perceptible.

- **Contraste WCAG (el segundo número).** Compara solo qué tan claro es cada color (luminancia), de 1:1 (igual de claros) a 21:1 (blanco sobre negro). La norma WCAG pide al menos 3:1 para gráficos e íconos. No mira el tono, por eso no basta sola.

- **El fondo de cada objeto** no es un color fijo. El programa mira los píxeles que rodean al objeto en la pantalla (a 6 píxeles en 8 direcciones) y saca el promedio. Si mueves la cámara, el fondo puede cambiar.

- **Sugerencia de color.** Si un objeto falla, el programa busca un color parecido (mismo tono si se puede) que sí pase ΔE y WCAG con esa luz, usando el espacio OKLCH.

## 8. Qué ves en el panel

- **Vista**: original o simulada. La tecla F cambia entre las dos.

- **Tipo y severidad** del daltonismo.

- **Luz**: azimut, elevación y color.

- **Marcas**: contorno, patrón o apagadas. La tecla H cambia entre ellas.

- **Lista de objetos**: cada fila muestra ΔE y contraste WCAG, ordenada del peor al mejor. Un clic selecciona el objeto y otro clic lo deselecciona.

- **Detalle del objeto**: valores para los cuatro tipos de visión, con qué otro objeto se confunde y una sugerencia de color.

## 9. Glosario rápido

- **GPU**: tarjeta de video. Hace muchos cálculos pequeños al mismo tiempo.

- **WebGL2**: la forma de usar la GPU desde una página web.

- **GLSL ES 3.00**: el lenguaje en que se escriben los shaders de WebGL2.

- **Normal**: flecha que indica hacia dónde mira una superficie.

- **FBO**: una "pantalla invisible" donde se dibuja antes de mostrar el resultado.

- **MRT**: dibujar en varias pantallas invisibles a la vez.

- **Protan, deutan, tritan**: daltonismo por falla de los conos del rojo, del verde o del azul.

- **ΔE**: qué tan diferentes se ven dos colores.

- **WCAG**: pautas internacionales de accesibilidad web.
