/* machado.js
 * Matrices de simulacion de daltonismo de Machado, Oliveira y Fernandes (2009).
 * "A Physiologically-based Model for Simulation of Color Vision Deficiency",
 * IEEE TVCG 15(6), 1291-1298. Tabla 1 de
 * https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
 * Son las mismas matrices que usa Chrome DevTools (Rendering > Emulate vision
 * deficiencies) para severidad 1.0.
 *
 * Operan sobre RGB LINEAL (no sRGB). Filas en orden row-major, como en el paper:
 *   [R'] = M * [R G B]^T
 * Severidad 0.0 a 1.0 en pasos de 0.1. Para valores intermedios se interpola
 * entre las dos matrices vecinas (aproximacion recomendada por los autores).
 * type: 0 normal, 1 protan, 2 deutan, 3 tritan.
 * Tritan usa Brettel 1997 (ver simParams); la tabla TRITAN de Machado queda
 * como referencia para tools/compare-models.js.
 */
(function () {
  'use strict';

  const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  const PROTAN = [
    I,
    [0.856167, 0.182038, -0.038205, 0.029342, 0.955115, 0.015544, -0.002880, -0.001563, 1.004443],
    [0.734766, 0.334872, -0.069637, 0.051840, 0.919198, 0.028963, -0.004928, -0.004209, 1.009137],
    [0.630323, 0.465641, -0.095964, 0.069181, 0.890046, 0.040773, -0.006308, -0.007724, 1.014032],
    [0.539009, 0.579343, -0.118352, 0.082546, 0.866121, 0.051332, -0.007136, -0.011959, 1.019095],
    [0.458064, 0.679578, -0.137642, 0.092785, 0.846313, 0.060902, -0.007494, -0.016807, 1.024301],
    [0.385450, 0.769005, -0.154455, 0.100526, 0.829802, 0.069673, -0.007442, -0.022190, 1.029632],
    [0.319627, 0.849633, -0.169261, 0.106241, 0.815969, 0.077790, -0.007025, -0.028051, 1.035076],
    [0.259411, 0.923008, -0.182420, 0.110296, 0.804340, 0.085364, -0.006276, -0.034346, 1.040622],
    [0.203876, 0.990338, -0.194214, 0.112975, 0.794542, 0.092483, -0.005222, -0.041043, 1.046265],
    [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998]
  ];

  const DEUTAN = [
    I,
    [0.866435, 0.177704, -0.044139, 0.049567, 0.939063, 0.011370, -0.003453, 0.007233, 0.996220],
    [0.760729, 0.319078, -0.079807, 0.090568, 0.889315, 0.020117, -0.006027, 0.013325, 0.992702],
    [0.675425, 0.433850, -0.109275, 0.125303, 0.847755, 0.026942, -0.007950, 0.018572, 0.989378],
    [0.605511, 0.528560, -0.134071, 0.155318, 0.812366, 0.032316, -0.009376, 0.023176, 0.986200],
    [0.547494, 0.607765, -0.155259, 0.181692, 0.781742, 0.036566, -0.010410, 0.027275, 0.983136],
    [0.498864, 0.674741, -0.173604, 0.205199, 0.754872, 0.039929, -0.011131, 0.030969, 0.980162],
    [0.457771, 0.731899, -0.189670, 0.226409, 0.731012, 0.042579, -0.011595, 0.034333, 0.977261],
    [0.422823, 0.781057, -0.203881, 0.245752, 0.709602, 0.044646, -0.011843, 0.037423, 0.974421],
    [0.392952, 0.823610, -0.216562, 0.263559, 0.690210, 0.046232, -0.011910, 0.040281, 0.971630],
    [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881]
  ];

  const TRITAN = [
    I,
    [0.926670, 0.092514, -0.019184, 0.021191, 0.964503, 0.014306, 0.008437, 0.054813, 0.936750],
    [0.895720, 0.133330, -0.029050, 0.029997, 0.945400, 0.024603, 0.013027, 0.104707, 0.882266],
    [0.905871, 0.127791, -0.033662, 0.026856, 0.941251, 0.031893, 0.013410, 0.148296, 0.838294],
    [0.948035, 0.089490, -0.037526, 0.014364, 0.946792, 0.038844, 0.010853, 0.193991, 0.795156],
    [1.017277, 0.027029, -0.044306, -0.006113, 0.958479, 0.047634, 0.006379, 0.248708, 0.744913],
    [1.104996, -0.046633, -0.058363, -0.032137, 0.971635, 0.060503, 0.001336, 0.317922, 0.680742],
    [1.193214, -0.109812, -0.083402, -0.058496, 0.979410, 0.079086, -0.002346, 0.403492, 0.598854],
    [1.257728, -0.139648, -0.118081, -0.078003, 0.975409, 0.102594, -0.003316, 0.501214, 0.502102],
    [1.278864, -0.125333, -0.153531, -0.084748, 0.957674, 0.127074, -0.000989, 0.601151, 0.399838],
    [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900]
  ];

  const TABLE = { 1: PROTAN, 2: DEUTAN, 3: TRITAN };

  // Brettel, Vienot y Mollon 1997 en RGB lineal, precalculado por libDaltonLens
  // (dominio publico, https://github.com/DaltonLens/libDaltonLens), modelo
  // LMS Smith-Pokorny 75 sobre sRGB. Dos semiplanos: se elige m1 si
  // dot(rgb, n) >= 0 y m2 en caso contrario. Machado es poco preciso en tritan,
  // por eso tritan usa Brettel. Severidad: interpolacion lineal con la identidad
  // (equivale a hacerlo en LMS porque la transformacion es lineal).
  const BRETTEL_TRITAN = {
    m1: [1.01277, 0.13548, -0.14826, -0.01243, 0.86812, 0.14431, 0.07589, 0.80500, 0.11911],
    m2: [0.93678, 0.18979, -0.12657, 0.06154, 0.81526, 0.12320, -0.37562, 1.12767, 0.24796],
    n: [0.03901, -0.02788, -0.01113]
  };

  // Vienot 1999 (libDaltonLens), solo para comparar modelos en tools/.
  const VIENOT = {
    1: [0.11238, 0.88762, 0.00000, 0.11238, 0.88762, 0.00000, 0.00401, -0.00401, 1.00000],
    2: [0.29275, 0.70725, 0.00000, 0.29275, 0.70725, 0.00000, -0.02234, 0.02234, 1.00000]
  };
  const BRETTEL = {
    1: { m1: [0.14980, 1.19548, -0.34528, 0.10764, 0.84864, 0.04372, 0.00384, -0.00540, 1.00156],
         m2: [0.14570, 1.16172, -0.30742, 0.10816, 0.85291, 0.03892, 0.00386, -0.00524, 1.00139],
         n: [0.00048, 0.00393, -0.00441] },
    2: { m1: [0.36477, 0.86381, -0.22858, 0.26294, 0.64245, 0.09462, -0.02006, 0.02728, 0.99278],
         m2: [0.37298, 0.88166, -0.25464, 0.25954, 0.63506, 0.10540, -0.01980, 0.02784, 0.99196],
         n: [-0.00281, -0.00611, 0.00892] },
    3: BRETTEL_TRITAN
  };

  function lerpI(m, s) {
    const out = new Array(9);
    for (let k = 0; k < 9; k++) out[k] = I[k] * (1 - s) + m[k] * s;
    return out;
  }

  // Matriz row-major 3x3 para tipo y severidad. Interpola entre pasos de 0.1.
  function simMatrix(type, severity) {
    const tab = TABLE[type];
    if (!tab) return I.slice();
    const s = Math.min(1, Math.max(0, Number(severity) || 0)) * 10;
    const i0 = Math.floor(s);
    const i1 = Math.min(10, i0 + 1);
    const w = s - i0;
    const a = tab[i0], b = tab[i1];
    const out = new Array(9);
    for (let k = 0; k < 9; k++) out[k] = a[k] * (1 - w) + b[k] * w;
    return out;
  }

  // Parametros que usa el shader: dos matrices y la normal del plano.
  // Protan y deutan (Machado): m1 = m2, asi el plano no importa.
  // Tritan (Brettel 1997): m1/m2 por semiplano, ya mezcladas con la identidad.
  function simParams(type, severity) {
    const s = Math.min(1, Math.max(0, Number(severity) || 0));
    if (type === 3) {
      return { m1: lerpI(BRETTEL_TRITAN.m1, s), m2: lerpI(BRETTEL_TRITAN.m2, s), n: BRETTEL_TRITAN.n.slice() };
    }
    const m = simMatrix(type, s);
    return { m1: m, m2: m, n: [0, 0, 1] };
  }

  // GLSL guarda mat3 en column-major. uniformMatrix3fv(loc, false, ...) espera
  // columnas, asi que se transpone aqui (WebGL1 no permite transpose=true).
  function toColumnMajor(m) {
    return new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
  }

  const api = { simMatrix: simMatrix, simParams: simParams, toColumnMajor: toColumnMajor, IDENTITY: I.slice(),
    MODELS: { BRETTEL: BRETTEL, VIENOT: VIENOT }, lerpI: lerpI };
  if (typeof window !== 'undefined') window.DALTON_MACHADO = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
