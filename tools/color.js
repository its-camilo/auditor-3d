/* tools/color.js — utilidades de color compartidas por las herramientas node.
 * Espacio de trabajo: sRGB lineal (D65). Lab CIE 1976 con blanco D65. */
const M = require('../machado.js');
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const enc = (c) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
const hexToLin = (h) => [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
const linToHex = (l) => '#' + l.map((v) => Math.round(enc(v) * 255).toString(16).padStart(2, '0')).join('');
const Y = (l) => 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
const mul = (m, l) => [0, 1, 2].map((r) => m[r * 3] * l[0] + m[r * 3 + 1] * l[1] + m[r * 3 + 2] * l[2]);
const clamp01 = (l) => l.map((v) => Math.min(1, Math.max(0, v)));
function lab(l) {
  const X = 0.4124 * l[0] + 0.3576 * l[1] + 0.1805 * l[2];
  const Yv = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  const Z = 0.0193 * l[0] + 0.1192 * l[1] + 0.9505 * l[2];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / 0.95047), fy = f(Yv), fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const dE = (a, b) => { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
const wcag = (a, b) => { const y1 = Y(a), y2 = Y(b); return (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05); };
// Simulacion igual a la del shader: tipo 1-2 Machado, tipo 3 Brettel 1997.
function simulate(type, sev, l) {
  const p = M.simParams(type, sev);
  const a = mul(p.m1, l), b = mul(p.m2, l);
  const side = l[0] * p.n[0] + l[1] * p.n[1] + l[2] * p.n[2] >= 0;
  return clamp01(side ? a : b);
}
module.exports = { lin, enc, hexToLin, linToHex, Y, mul, lab, dE, wcag, simulate, clamp01 };
