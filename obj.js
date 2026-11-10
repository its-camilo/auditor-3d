/* obj.js — lector propio de Wavefront OBJ (sin librerías, requisito del curso).
 * Soporta: o/g (nombre de objeto), v, vn, f con índices v, v/vt, v//vn y v/vt/vn,
 * índices negativos y caras de más de 3 vértices (abanico). Si una cara no trae
 * normales, usa la normal plana del triángulo.
 * Devuelve { nombre: { pos: Float32Array, nor: Float32Array, count } }
 * en arreglos no indexados, listos para gl.drawArrays.
 * Funciona con OBJ exportados de Blender (Forward -Z, Up Y, Write Normals).
 */
(function (root) {
  'use strict';
  function parseOBJ(text) {
    const V = [], N = [], out = {};
    let cur = null;
    const part = (name) => (out[name] || (out[name] = { pos: [], nor: [] }));
    const idx = (s, len) => { const i = parseInt(s, 10); return i < 0 ? len + i : i - 1; };
    const lines = text.split('\n');
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li].trim();
      if (!line || line[0] === '#') continue;
      const t = line.split(/\s+/);
      switch (t[0]) {
        case 'v': V.push([+t[1], +t[2], +t[3]]); break;
        case 'vn': N.push([+t[1], +t[2], +t[3]]); break;
        case 'o': case 'g': cur = part(t.slice(1).join(' ') || 'default'); break;
        case 'f': {
          if (!cur) cur = part('default');
          const vs = t.slice(1).map((s) => { const p = s.split('/'); return { v: idx(p[0], V.length), n: p[2] ? idx(p[2], N.length) : -1 }; });
          for (let k = 1; k + 1 < vs.length; k++) {
            const tri = [vs[0], vs[k], vs[k + 1]];
            const P = tri.map((x) => V[x.v]);
            let flat = null;
            if (tri.some((x) => x.n < 0)) {
              const a = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]];
              const b = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
              const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
              const l = Math.hypot(c[0], c[1], c[2]) || 1; flat = [c[0] / l, c[1] / l, c[2] / l];
            }
            tri.forEach((x, j) => { cur.pos.push(...P[j]); cur.nor.push(...(x.n >= 0 ? N[x.n] : flat)); });
          }
          break;
        }
        default: break;
      }
    }
    Object.keys(out).forEach((k) => { const o = out[k]; o.count = o.pos.length / 3; o.pos = new Float32Array(o.pos); o.nor = new Float32Array(o.nor); });
    return out;
  }
  const api = { parseOBJ };
  if (typeof module !== 'undefined') module.exports = api;
  else root.OBJ = api;
})(typeof window !== 'undefined' ? window : globalThis);
