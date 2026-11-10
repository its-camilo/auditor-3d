/* scene.js
 * Escena v0: anden de una estacion de TransMilenio hecho con cajas.
 * La misma tabla alimenta el render (main.js) y la teoria (tools/).
 * Colores APROXIMADOS. Pendiente: calibrar con el Manual de Imagen de
 * TransMilenio (v4, junio 2023), que entrega Pantone, CMYK y RGB.
 *
 * Ejes: y hacia arriba, la camara mira hacia -z.
 * id 0 queda reservado para "sin objeto" en el buffer de IDs.
 * bg: id del fondo adyacente que el diseno pretende (para tools/teoria).
 * n:  normal de la cara que se ve de frente (para tools/teoria).
 */
(function (root) {
  'use strict';
  const OBJECTS = [
    { id: 1, name: 'Piso del anden', hex: '#8a8a8a', c: [0, -0.05, 0], s: [12, 0.1, 8], ks: 0.05, sh: 8, bg: 0, n: [0, 1, 0] },
    { id: 2, name: 'Pared de la estacion', hex: '#c9d3d6', c: [0, 2, -3.1], s: [12, 4, 0.2], ks: 0.05, sh: 8, bg: 0, n: [0, 0, 1] },
    { id: 3, name: 'Franja podotactil', hex: '#f2c200', c: [0, 0.011, 1.4], s: [12, 0.02, 0.45], ks: 0.10, sh: 16, bg: 1, n: [0, 1, 0] },
    { id: 4, name: 'Senal troncal roja', hex: '#c8102e', c: [-3.0, 2.9, -2.95], s: [1.6, 0.7, 0.1], ks: 0.30, sh: 32, bg: 2, n: [0, 0, 1] },
    { id: 5, name: 'Senal troncal verde', hex: '#3aa655', c: [-1.2, 2.9, -2.95], s: [1.6, 0.7, 0.1], ks: 0.30, sh: 32, bg: 2, n: [0, 0, 1] },
    { id: 6, name: 'Panel de ayuda verde', hex: '#3a7d44', c: [2.6, 1.5, -2.95], s: [1.2, 1.2, 0.1], ks: 0.20, sh: 32, bg: 2, n: [0, 0, 1] },
    { id: 7, name: 'Boton de emergencia rojo', hex: '#c62828', c: [2.6, 1.5, -2.86], s: [0.4, 0.4, 0.08], ks: 0.50, sh: 64, bg: 6, n: [0, 0, 1] },
    { id: 8, name: 'Bus troncal rojo', hex: '#b3121b', c: [-4.6, 1.4, 0.3], s: [2.4, 2.6, 5.0], ks: 0.40, sh: 48, bg: 2, n: [1, 0, 0] },
    { id: 9, name: 'Banca azul', hex: '#1f4e9c', c: [0.8, 0.45, -2.3], s: [2.2, 0.3, 0.6], ks: 0.15, sh: 16, bg: 1, n: [0, 1, 0] }
  ];

  // Luces de prueba (color en RGB lineal, aproximado).
  const LIGHTS = {
    blanca: { name: 'Blanca D65', color: [1, 1, 1] },
    sodio: { name: 'Sodio (noche, aprox.)', color: [1.0, 0.55, 0.12] },
    ledFria: { name: 'LED fria (aprox.)', color: [0.82, 0.92, 1.0] }
  };

  const api = { OBJECTS, LIGHTS, byId: (id) => OBJECTS.find((o) => o.id === id) };
  if (typeof module !== 'undefined') module.exports = api;
  else root.SCENE = api;
})(typeof window !== 'undefined' ? window : globalThis);
