/* audit-core.js
 * Nucleo matematico del Auditor 3D. Lo usan el navegador (main.js) y node
 * (tools/). Un solo archivo para la teoria y la implementacion: la prueba de
 * tools/teoria-conmutacion.js corre exactamente el mismo codigo que el HUD.
 *
 * Espacio de trabajo: sRGB lineal D65.
 * Referencias:
 * - Machado, Oliveira, Fernandes 2009 (protan, deutan). Brettel 1997 (tritan).
 *   Matrices en machado.js (copiado sin cambios del Proyecto 1).
 * - W3C WCAG 2.2, SC 1.4.11 (contraste no textual 3:1) y luminancia relativa.
 * - Ottosson 2020, OKLab (https://bottosson.github.io/posts/oklab/).
 * - Blinn 1977, modelo de reflexion con vector medio.
 */
(function (root) {
  'use strict';
  const M = (typeof module !== 'undefined' && typeof require !== 'undefined')
    ? require('./machado.js') : root.DALTON_MACHADO;

  // ---------- sRGB ----------
  const lin1 = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const enc1 = (c) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
  const hexToLin = (h) => [1, 3, 5].map((i) => lin1(parseInt(h.slice(i, i + 2), 16) / 255));
  const linToHex = (l) => '#' + l.map((v) => Math.round(enc1(v) * 255).toString(16).padStart(2, '0')).join('');

  // ---------- vectores 3 ----------
  const mul3 = (m, v) => [0, 1, 2].map((r) => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2]);
  const had = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
  const clamp01 = (v) => v.map((x) => Math.min(1, Math.max(0, x)));

  // ---------- luminancia y contraste ----------
  const Y = (l) => 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  const wcag = (a, b) => { const y1 = Y(a), y2 = Y(b); return (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05); };

  // ---------- OKLab (Ottosson 2020) ----------
  function oklab(c) {
    const l = Math.cbrt(Math.max(0, 0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]));
    const m = Math.cbrt(Math.max(0, 0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]));
    const s = Math.cbrt(Math.max(0, 0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]));
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function oklabToLin(L) {
    const l = Math.pow(L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2], 3);
    const m = Math.pow(L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2], 3);
    const s = Math.pow(L[0] - 0.0894841775 * L[1] - 1.2914855480 * L[2], 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  const dEok = (a, b) => { const A = oklab(a), B = oklab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
  const toOklch = (c) => { const L = oklab(c); return [L[0], Math.hypot(L[1], L[2]), Math.atan2(L[2], L[1])]; };
  const fromOklch = (L, C, h) => oklabToLin([L, C * Math.cos(h), C * Math.sin(h)]);
  const inGamut = (c) => c.every((x) => x >= -1e-4 && x <= 1 + 1e-4);

  // ---------- simulacion (igual que daltonizador.frag) ----------
  // raw = true omite el clamp final, para estudiar la parte lineal pura.
  function simulate(type, sev, l, raw) {
    if (!type) return l.slice();
    const p = M.simParams(type, sev);
    const side = dot(l, p.n) >= 0;
    const out = side ? mul3(p.m1, l) : mul3(p.m2, l);
    return raw ? out : clamp01(out);
  }

  // Atenuacion inversa cuadratica suave (escena.frag uAttenK): 1 / (1 + k d^2).
  const LIGHT_ATTEN_K = 0.035;
  const SCENE_TARGET = [0, 1.4, -0.6];

  // ---------- Blinn-Phong punto (igual que escena.frag) ----------
  // light = { pos, color, ambient, intensity }, worldPos y eye en mundo.
  function blinnPhong(kd, mat, n, light, worldPos, eye) {
    const toL = [light.pos[0] - worldPos[0], light.pos[1] - worldPos[1], light.pos[2] - worldPos[2]];
    const dist = Math.hypot(toL[0], toL[1], toL[2]);
    const L = norm(toL);
    const toV = [eye[0] - worldPos[0], eye[1] - worldPos[1], eye[2] - worldPos[2]];
    const V = norm(toV);
    const H = norm(add(L, V));
    const N = norm(n);
    const diff = Math.max(dot(N, L), 0);
    const spec = diff > 0 ? Math.pow(Math.max(dot(N, H), 0), mat.shininess) : 0;
    const atten = 1 / (1 + LIGHT_ATTEN_K * dist * dist);
    const a = (light.ambient + light.intensity * diff) * atten;
    const s = light.intensity * mat.ks * spec * atten;
    return add(scl(had(kd, light.color), a), scl(light.color, s));
  }

  // Direccion unitaria (azimut, elevacion) para colocar la fuente alrededor del target.
  function lightDir(azDeg, elDeg) {
    const az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180;
    return [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  }

  function lightPosFromAzEl(azDeg, elDeg, dist, target = SCENE_TARGET) {
    const dir = lightDir(azDeg, elDeg);
    const p = [target[0] + dir[0] * dist, target[1] + dir[1] * dist, target[2] + dir[2] * dist];
    p[1] = Math.min(3.6, Math.max(1.15, p[1]));
    p[0] = Math.min(5, Math.max(-5, p[0]));
    p[2] = Math.min(4, Math.max(-3, p[2]));
    return p;
  }

  function worldOnNormal(target, n, dist = 0.6) {
    return [target[0] + n[0] * dist, target[1] + n[1] * dist, target[2] + n[2] * dist];
  }

  // ---------- metricas de un par objeto/fondo ----------
  const TYPES = ['normal', 'protan', 'deutan', 'tritan'];
  function pairMetrics(obj, bg, sev, skipSimulateType) {
    return TYPES.map((name, t) => {
      const color = (c) => (skipSimulateType === t ? clamp01(c) : simulate(t, sev, c));
      const a = color(obj), b = color(bg);
      return { type: name, wcag: wcag(a, b), dE: dEok(a, b) };
    });
  }

  // Umbrales v0. TAU_DE es provisional y se calibra con usuarios (ver docs).
  const TH = { WCAG: 3.0, TAU_DE: 0.08 };
  // Estado del par para un tipo: 2 falla (no distinguible), 1 aviso (WCAG < 3:1), 0 bien.
  const status = (m) => (m.dE < TH.TAU_DE ? 2 : (m.wcag < TH.WCAG ? 1 : 0));

  // ---------- sugerencia de color ----------
  // Busca en OKLCH, con el mismo tono h, el albedo mas cercano al original que pase
  // en los tres tipos. La prediccion del color renderizado usa la linealidad del
  // termino difuso: render' = render * (albedo' / albedo) canal a canal.
  function suggest(albedo, rendered, bgRendered, sev) {
    const base = toOklch(albedo);
    const ratio = [0, 1, 2].map((k) => rendered[k] / Math.max(albedo[k], 1e-4));
    let best = null;
    for (let L = 0.15; L <= 0.97; L += 0.01) {
      for (let C = 0; C <= 0.30; C += 0.01) {
        for (const dh of [0, -0.35, 0.35, -0.7, 0.7]) {
          const cand = fromOklch(L, C, base[2] + dh);
          if (!inGamut(cand)) continue;
          const c = clamp01(cand);
          const pred = clamp01(had(c, ratio));
          let ok = true;
          for (let t = 1; t <= 3 && ok; t++) {
            const a = simulate(t, sev, pred), b = simulate(t, sev, bgRendered);
            if (dEok(a, b) < TH.TAU_DE || wcag(a, b) < TH.WCAG) ok = false;
          }
          if (!ok) continue;
          const cost = dEok(c, albedo) + (dh ? 0.05 : 0); // preferir mismo tono
          if (!best || cost < best.cost) best = { cost, albedo: c, hex: linToHex(c), dh };
        }
      }
    }
    return best;
  }

  const api = { lin1, enc1, hexToLin, linToHex, mul3, had, add, scl, dot, norm, clamp01, Y, wcag,
    oklab, oklabToLin, dEok, toOklch, fromOklch, inGamut, simulate, blinnPhong, lightDir,
    TYPES, pairMetrics, TH, status, suggest, LIGHT_ATTEN_K, SCENE_TARGET,
    lightPosFromAzEl, worldOnNormal };
  if (typeof module !== 'undefined') module.exports = api;
  else root.AUDIT = api;
})(typeof window !== 'undefined' ? window : globalThis);
