/* scene.js
 * Escena v1: andén de una estación de TransMilenio con modelos OBJ propios
 * (models/*.obj, generados por tools/generar-modelos.py o exportados de Blender).
 * La misma tabla alimenta el render (main.js) y la teoría (tools/).
 * Colores APROXIMADOS. Pendiente: calibrar con el Manual de Imagen de
 * TransMilenio (v4, junio 2023).
 *
 * Campos: id (1..255, 0 = sin objeto), model + part (archivo y nombre "o" del OBJ),
 * hex (albedo sRGB), ks/sh (especular), role ('figura' se audita, 'fondo' no),
 * bg (fondo adyacente previsto, para tools/teoria), n (normal de la cara visible).
 * Ejes: y hacia arriba, la cámara mira hacia -z.
 */
(function (root) {
  'use strict';
  const F = 'figura', B = 'fondo';
  const UP = [0, 1, 0], FRONT = [0, 0, 1], SIDE = [1, 0, 0];
  const OBJECTS = [
    { id: 1, name: 'Piso del andén', model: 'anden', part: 'piso', hex: '#8a8a8a', ks: 0.05, sh: 8, role: B, bg: 0, n: UP },
    { id: 2, name: 'Borde del andén', model: 'anden', part: 'borde_anden', hex: '#d9d9d9', ks: 0.05, sh: 8, role: B, bg: 0, n: UP },
    { id: 3, name: 'Pared de la estación', model: 'anden', part: 'pared', hex: '#c9d3d6', ks: 0.05, sh: 8, role: B, bg: 0, n: FRONT },
    { id: 4, name: 'Techo', model: 'anden', part: 'techo', hex: '#9aa3a8', ks: 0.05, sh: 8, role: B, bg: 0, n: [0, -1, 0] },
    { id: 5, name: 'Columnas', model: 'anden', part: 'columnas', hex: '#7d878c', ks: 0.35, sh: 32, role: B, bg: 0, n: FRONT },
    { id: 6, name: 'Franja podotáctil', model: 'anden', part: 'franja_podotactil', hex: '#f2c200', ks: 0.10, sh: 16, role: F, bg: 1, n: UP },
    { id: 7, name: 'Señal troncal roja (H)', model: 'senales', part: 'senal_roja', hex: '#c8102e', ks: 0.30, sh: 32, role: F, bg: 3, n: FRONT },
    { id: 8, name: 'Letra H', model: 'senales', part: 'letra_roja', hex: '#ffffff', ks: 0.10, sh: 16, role: F, bg: 7, n: FRONT },
    { id: 9, name: 'Señal troncal verde (B)', model: 'senales', part: 'senal_verde', hex: '#3aa655', ks: 0.30, sh: 32, role: F, bg: 3, n: FRONT },
    { id: 10, name: 'Letra B', model: 'senales', part: 'letra_verde', hex: '#ffffff', ks: 0.10, sh: 16, role: F, bg: 9, n: FRONT },
    { id: 11, name: 'Mapa de troncales', model: 'senales', part: 'mapa_panel', hex: '#f2f2ec', ks: 0.10, sh: 16, role: F, bg: 3, n: FRONT },
    { id: 12, name: 'Ruta 1 roja (círculo)', model: 'senales', part: 'ruta_1', hex: '#e53935', ks: 0.10, sh: 16, role: F, bg: 11, n: FRONT },
    { id: 13, name: 'Ruta 2 verde (cuadrado)', model: 'senales', part: 'ruta_2', hex: '#43a047', ks: 0.10, sh: 16, role: F, bg: 11, n: FRONT },
    { id: 14, name: 'Ruta 3 naranja (triángulo)', model: 'senales', part: 'ruta_3', hex: '#ef6c00', ks: 0.10, sh: 16, role: F, bg: 11, n: FRONT },
    { id: 15, name: 'Ruta 4 oliva (rombo)', model: 'senales', part: 'ruta_4', hex: '#558b2f', ks: 0.10, sh: 16, role: F, bg: 11, n: FRONT },
    { id: 16, name: 'Ruta 5 mostaza (hexágono)', model: 'senales', part: 'ruta_5', hex: '#8d6e00', ks: 0.10, sh: 16, role: F, bg: 11, n: FRONT },
    { id: 17, name: 'Ruta 6 violeta (cruz)', model: 'senales', part: 'ruta_6', hex: '#ab47bc', ks: 0.10, sh: 16, role: F, bg: 11, n: FRONT },
    { id: 18, name: 'Panel de ayuda verde', model: 'senales', part: 'panel_ayuda', hex: '#3a7d44', ks: 0.20, sh: 32, role: F, bg: 3, n: FRONT },
    { id: 19, name: 'Botón de emergencia rojo', model: 'senales', part: 'boton_emergencia', hex: '#c62828', ks: 0.50, sh: 64, role: F, bg: 18, n: FRONT },
    { id: 20, name: 'Bus troncal rojo', model: 'bus', part: 'bus_carroceria', hex: '#b3121b', ks: 0.40, sh: 48, role: F, bg: 3, n: SIDE },
    { id: 21, name: 'Ventanas del bus', model: 'bus', part: 'bus_ventanas', hex: '#1c2a33', ks: 0.80, sh: 96, role: F, bg: 20, n: SIDE },
    { id: 22, name: 'Puerta del bus', model: 'bus', part: 'bus_puerta', hex: '#5d6a70', ks: 0.40, sh: 48, role: F, bg: 20, n: SIDE },
    { id: 23, name: 'Ruedas del bus', model: 'bus', part: 'bus_ruedas', hex: '#1a1a1a', ks: 0.10, sh: 8, role: B, bg: 0, n: SIDE },
    { id: 24, name: 'Banca azul', model: 'banca', part: 'banca_asiento', hex: '#1f4e9c', ks: 0.15, sh: 16, role: F, bg: 1, n: UP },
    { id: 25, name: 'Patas de la banca', model: 'banca', part: 'banca_patas', hex: '#7d878c', ks: 0.35, sh: 32, role: B, bg: 0, n: UP }
  ];

  // Luces de prueba (color en RGB lineal, aproximado).
  const LIGHTS = {
    blanca: { name: 'Blanca D65', color: [1, 1, 1] },
    sodio: { name: 'Sodio (noche, aprox.)', color: [1.0, 0.55, 0.12] },
    ledFria: { name: 'LED fría (aprox.)', color: [0.82, 0.92, 1.0] }
  };

  const api = { OBJECTS, LIGHTS, byId: (id) => OBJECTS.find((o) => o.id === id) };
  if (typeof module !== 'undefined') module.exports = api;
  else root.SCENE = api;
})(typeof window !== 'undefined' ? window : globalThis);
