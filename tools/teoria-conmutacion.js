/* tools/teoria-conmutacion.js
 * Verifica con numeros la Proposicion 1 de la revision teorica y calcula el
 * "mapa de angulos ciegos" de cada par objeto/fondo de scene.js.
 * Ejecutar: node tools/teoria-conmutacion.js
 *
 * Proposicion 1. Sea S una matriz de simulacion lineal con S*1 = 1 (conserva el
 * blanco) y sea la luz blanca. Blinn-Phong da I = a*kd + s*1 con a, s escalares.
 * Entonces S*I = a*(S*kd) + s*1: simular despues de iluminar es igual que
 * iluminar un material ya simulado. Falla solo por el clamp y por el semiplano
 * de Brettel (tritan). Con luz de color L, S*(kd o L) != (S*kd) o L.
 */
const A = require('../js/audit-core.js');
const M = require('../js/machado.js');
const { OBJECTS, LIGHTS, byId } = require('../js/scene.js');

const SEV = Number(process.argv[2] || 1.0);
const line = (s) => console.log(s);

// ---------- 1. S*1 = 1 ----------
line('1) Conservacion del blanco: max |S*1 - 1| por tipo (severidad 0..1)');
for (let t = 1; t <= 3; t++) {
  let worst = 0;
  for (let k = 0; k <= 10; k++) {
    const p = M.simParams(t, k / 10);
    for (const m of [p.m1, p.m2]) for (const v of A.mul3(m, [1, 1, 1])) worst = Math.max(worst, Math.abs(v - 1));
  }
  line(`   ${A.TYPES[t].padEnd(7)} ${worst.toExponential(2)}`);
}

// ---------- 2. Conmutacion con luz blanca y con luz de color ----------
function rnd() { return [Math.random(), Math.random(), Math.random()]; }
function commutationError(lightColor, trials) {
  let worst = 0, mean = 0;
  for (let i = 0; i < trials; i++) {
    const kd = rnd().map((x) => x * 0.9);
    const mat = { ks: Math.random() * 0.5, shininess: 32 };
    const light = { dir: A.lightDir(Math.random() * 360, 10 + Math.random() * 70), color: lightColor, ambient: 0.2, intensity: 0.8 };
    const n = A.norm([Math.random() - 0.5, Math.random(), Math.random() - 0.5]);
    const t = 1 + (i % 2); // Machado protan/deutan (lineales puros)
    const left = A.simulate(t, SEV, A.blinnPhong(kd, mat, n, light, [0, 0.3, 1]), true);
    const right = A.blinnPhong(A.simulate(t, SEV, kd, true), mat, n, light, [0, 0.3, 1]);
    const e = A.dEok(A.clamp01(left), A.clamp01(right));
    worst = Math.max(worst, e); mean += e / trials;
  }
  return { worst, mean };
}
line(`\n2) Conmutacion sim(shade(c)) vs shade(sim(c)), 20000 muestras, severidad ${SEV}`);
for (const key of Object.keys(LIGHTS)) {
  const r = commutationError(LIGHTS[key].color, 20000);
  line(`   ${LIGHTS[key].name.padEnd(24)} dE_OK medio ${r.mean.toFixed(4)}  maximo ${r.worst.toFixed(4)}`);
}

// ---------- 3. Mapa de angulos ciegos por par ----------
// Barre azimut y elevacion de la luz. Para cada par objeto/fondo y cada tipo
// busca el peor caso (minimo dE_OK simulado) y el angulo donde ocurre (theta*).
line(`\n3) Angulos ciegos (luz blanca, severidad ${SEV}). Umbral dE_OK ${A.TH.TAU_DE}, WCAG ${A.TH.WCAG}:1`);
line('   Par'.padEnd(52) + 'tipo     dE min   theta* (az,el)   WCAG en theta*   dE-rango       Yobj/Yfondo');
const view = [0, 0.3, 1];
for (const o of OBJECTS) {
  if (!o.bg) continue;
  const b = byId(o.bg);
  const kdO = A.hexToLin(o.hex), kdB = A.hexToLin(b.hex);
  const sameNormal = A.dot(A.norm(o.n), A.norm(b.n)) > 0.999;
  for (let t = 1; t <= 3; t++) {
    let best = null, maxDE = 0, rMin = Infinity, rMax = 0;
    for (let az = -90; az <= 90; az += 5) {
      for (let el = 5; el <= 85; el += 5) {
        const light = { dir: A.lightDir(az, el), color: [1, 1, 1], ambient: 0.2, intensity: 0.8 };
        const io = A.blinnPhong(kdO, { ks: o.ks, shininess: o.sh }, o.n, light, view);
        const ib = A.blinnPhong(kdB, { ks: b.ks, shininess: b.sh }, b.n, light, view);
        const so = A.simulate(t, SEV, io), sb = A.simulate(t, SEV, ib);
        const dE = A.dEok(so, sb);
        maxDE = Math.max(maxDE, dE);
        const r = A.Y(so) / Math.max(A.Y(sb), 1e-6); rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
        if (!best || dE < best.dE) best = { dE, az, el, wcag: A.wcag(so, sb) };
      }
    }
    const flag = best.dE < A.TH.TAU_DE ? ' FALLA' : '';
    line(`   ${(o.name + ' / ' + b.name).padEnd(48).slice(0, 48)} ${A.TYPES[t].padEnd(7)} ${best.dE.toFixed(3)}   (${String(best.az).padStart(3)},${String(best.el).padStart(2)})        ${best.wcag.toFixed(2)}:1          ${best.dE.toFixed(3)}-${maxDE.toFixed(3)}   ${rMin.toFixed(2)}-${rMax.toFixed(2)}${sameNormal ? '  [misma normal]' : ''}${flag}`);
  }
}
line('\nLectura (Corolario 1): con la misma normal la razon Yobj/Yfondo casi no cambia con la luz');
line('(solo la mueve el especular); el angulo solo oscurece o aclara todo. Con normales distintas');
line('la razon barre un rango y puede cruzar 1.0: isoluminancia. Ahi el dicromata pierde el par.');
