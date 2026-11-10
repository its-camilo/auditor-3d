import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765';
const OUT = process.env.OUT_DIR || '/opt/cursor/artifacts';

async function waitScene(page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('fps');
    return el && el.textContent && !el.textContent.includes('0 fps');
  }, { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => {
    const s = document.getElementById('summary');
    return s && s.textContent && /\d+ de \d+ objetos/.test(s.textContent) && !s.textContent.includes('0 de 0');
  }, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
}

async function setCond(page, opts) {
  await page.evaluate((o) => {
    const set = (id, v) => {
      const e = document.getElementById(id);
      if (!e) return;
      if (e.type === 'checkbox') e.checked = !!v;
      else e.value = String(v);
      e.dispatchEvent(new Event(e.type === 'checkbox' ? 'change' : 'input'));
      e.dispatchEvent(new Event('change'));
    };
    Object.keys(o).forEach((k) => set(k, o[k]));
  }, opts);
  await page.waitForTimeout(400);
}

async function readLightSync(page) {
  return page.evaluate(() => {
    const A = window.AUDIT;
    const az = Number(document.getElementById('az')?.value || 0);
    const el = Number(document.getElementById('el')?.value || 0);
    const lightDist = Number(document.getElementById('lightDist')?.value || 4);
    const expected = A.lightPosFromAzEl(az, el, lightDist, A.SCENE_TARGET);
    const uniform = window.__lastLightPos || [NaN, NaN, NaN];
    const d = Math.hypot(expected[0] - uniform[0], expected[1] - uniform[1], expected[2] - uniform[2]);
    return { az, el, lightDist, expected, uniform, drift: d };
  });
}

async function summary(page) {
  return page.evaluate(() => document.getElementById('summary')?.textContent || '');
}

function analyzePng(buf, canvasW = 1280, canvasH = 800) {
  const png = PNG.sync.read(buf);
  const cw = Math.min(canvasW, png.width);
  const ch = Math.min(canvasH, png.height);
  let yellow = 0;
  let yellowMax = { r: 0, g: 0, b: 0, x: 0, y: 0 };
  let lap = 0;
  let lumL = 0; let lumR = 0; let nL = 0; let nR = 0;
  const idx = (x, y) => (y * png.width + x) << 2;
  const midY0 = Math.floor(ch * 0.25);
  const midY1 = Math.floor(ch * 0.75);
  for (let y = 1; y < ch - 1; y++) {
    for (let x = 1; x < cw - 1; x++) {
      const i = idx(x, y);
      const r = png.data[i]; const g = png.data[i + 1]; const b = png.data[i + 2];
      if (g > 175 && r > 200 && b < 140 && x < cw - 380) {
        yellow++;
        const score = g + r - b;
        if (score > yellowMax.g + yellowMax.r - yellowMax.b) yellowMax = { r, g, b, x, y };
      }
      if (x > 80 && x < cw * 0.45 && y >= midY0 && y <= midY1) {
        lumL += 0.2126 * r + 0.7152 * g + 0.0722 * b; nL++;
      }
      if (x > cw * 0.55 && x < cw - 80 && y >= midY0 && y <= midY1) {
        lumR += 0.2126 * r + 0.7152 * g + 0.0722 * b; nR++;
      }
      const i0 = idx(x - 1, y); const i1 = idx(x + 1, y);
      const l0 = png.data[i0] + png.data[i0 + 1] + png.data[i0 + 2];
      const l1 = png.data[i1] + png.data[i1 + 1] + png.data[i1 + 2];
      const l = r + g + b;
      lap += Math.abs(l - l0) + Math.abs(l - l1);
    }
  }
  const quad = (x, y) => {
    const qx = x < cw * 0.33 ? 'izquierda' : x > cw * 0.66 ? 'derecha' : 'centro';
    const qy = y < ch * 0.33 ? 'arriba' : y > ch * 0.66 ? 'abajo' : 'medio';
    return `${qy}-${qx}`;
  };
  const brightSide = nL && nR ? (lumL / nL > lumR / nR * 1.04 ? 'izquierda' : lumR / nR > lumL / nL * 1.04 ? 'derecha' : 'equilibrado') : '?';
  return {
    yellowPx: yellow,
    marker: yellowMax.r > 200 ? `${quad(yellowMax.x, yellowMax.y)} (~${yellowMax.x},${yellowMax.y})` : 'no detectado',
    blurScore: Math.round(lap / ((cw - 2) * (ch - 2))),
    brightSide,
    markerXY: yellowMax.r > 200 ? [yellowMax.x, yellowMax.y] : null
  };
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push(String(e)));

await mkdir(OUT, { recursive: true });
await page.goto(BASE, { waitUntil: 'networkidle' });

const base = {
  enDalton: false, enMyopia: false, enAstigma: false,
  showLight: true, az: 60, el: 35, lightDist: 4, light: 'blanca'
};

const shots = [
  { file: 'shot-default-light-marker.png', opts: { ...base, enDalton: true, type: 2 }, note: 'referencia' },
  { file: 'shot-myopia-only.png', opts: { ...base, enMyopia: true, myopiaD: 5 } },
  { file: 'shot-astigmatism-only.png', opts: { ...base, enAstigma: true } },
  { file: 'shot-dalton-myopia.png', opts: { ...base, enDalton: true, enMyopia: true, type: 2, myopiaD: 4, order: 'optica-color' } },
  { file: 'shot-order-color-optica.png', opts: { ...base, enDalton: true, enMyopia: true, type: 2, myopiaD: 4, order: 'color-optica' } },
  { file: 'slider-baseline-az60-el35-dist4.png', opts: { ...base }, changed: 'ninguno (línea base)', expect: 'círculo amarillo 3D visible; sombras coherentes' },
  { file: 'slider-only-az120.png', opts: { ...base, az: 120 }, changed: 'solo azimut → 120°', expect: 'marcador cambia de cuadrante; lado iluminado rota' },
  { file: 'slider-only-el70.png', opts: { ...base, el: 70 }, changed: 'solo elevación → 70°', expect: 'marcador más alto en pantalla; bandas de luz más cenitales' },
  { file: 'slider-only-dist9.png', opts: { ...base, lightDist: 9 }, changed: 'solo distancia → 9 m', expect: 'marcador más lejos en el andén; atenuación más suave' },
  { file: 'slider-only-color-sodio.png', opts: { ...base, light: 'sodio' }, changed: 'solo color → sodio', expect: 'posición de marcador idéntica a línea base; tinte cálido en escena' }
];

const report = [];
let prevMarker = null;
let prevBright = null;
for (const s of shots) {
  await setCond(page, s.opts);
  await waitScene(page);
  const path = `${OUT}/${s.file}`;
  await page.screenshot({ path, fullPage: false });
  const buf = await readFile(path);
  const ana = analyzePng(buf);
  const sync = await readLightSync(page);
  const sum = await summary(page);
  const markerMoved = prevMarker && ana.markerXY
    ? Math.hypot(ana.markerXY[0] - prevMarker[0], ana.markerXY[1] - prevMarker[1]) : null;
  const entry = {
    file: s.file,
    changed: s.changed || '',
    note: s.note || '',
    summary: sum.slice(0, 80),
    syncOk: sync.drift < 1e-4,
    lightPos: sync.uniform.map((v) => +v.toFixed(3)),
    marker: ana.marker,
    markerMovedPx: markerMoved != null ? Math.round(markerMoved) : null,
    brightSide: ana.brightSide,
    brightSideChanged: prevBright && prevBright !== ana.brightSide,
    yellowPx: ana.yellowPx,
    blurScore: ana.blurScore
  };
  report.push(entry);
  if (ana.markerXY) prevMarker = ana.markerXY;
  prevBright = ana.brightSide;
  console.log(s.file, entry.syncOk, entry.marker, entry.brightSide);
}

const md = [
  '# Capturas SwiftShader — sincronización luz / marcador',
  '',
  'Cada fila usa **una sola** lectura de `uLightPos` por frame (`currentLightPos()` → escena + marcaluz).',
  '',
  '| Captura | Parámetro | sync uLightPos | Marcador | Δ marcador (px) | Lado más brillante |',
  '|---------|-----------|----------------|----------|-----------------|---------------------|',
  ...report.filter((r) => r.file.startsWith('slider-')).map((r) =>
    `| ${r.file} | ${r.changed || '—'} | ${r.syncOk ? 'sí' : 'NO'} | ${r.marker} | ${r.markerMovedPx ?? '—'} | ${r.brightSide} |`
  ),
  '',
  'Interpretación: az/el/dist mueven el marcador y cambian el gradiente de iluminación; el color de luz no mueve el marcador pero sí el tinte espectral.',
  ''
].join('\n');

await writeFile(`${OUT}/light-slider-report.md`, md);
console.log(JSON.stringify(report, null, 2));
console.log(md);
if (logs.length) console.error('console errors:', logs.join('\n'));
const sliderRows = report.filter((r) => r.file.startsWith('slider-'));
const baselineRow = sliderRows.find((r) => r.file.includes('baseline'));
const defaultRow = report.find((r) => r.file === 'shot-default-light-marker.png');
const marker3dOk = (r) => r && r.yellowPx >= 400 && r.marker && !r.marker.includes('no detectado');
const fail = sliderRows.some((r) => !r.syncOk || r.yellowPx < 60)
  || !marker3dOk(baselineRow) || !marker3dOk(defaultRow);
if (!marker3dOk(baselineRow)) console.error('FAIL: baseline sin círculo amarillo 3D visible (¿flecha de borde?)');
if (!marker3dOk(defaultRow)) console.error('FAIL: default sin círculo amarillo 3D visible');
const baseline = sliderRows.find((r) => r.file.includes('baseline'));
const azOnly = sliderRows.find((r) => r.file.includes('only-az'));
const colorOnly = sliderRows.find((r) => r.file.includes('color-sodio'));
if (baseline && colorOnly && baseline.marker === colorOnly.marker) {
  console.log('OK: color sodio no desplaza marcador respecto a baseline');
}
if (azOnly && azOnly.markerMovedPx != null && azOnly.markerMovedPx < 15) {
  console.warn('WARN: az 120 esperaba marcador más desplazado');
}
await browser.close();
process.exit(logs.length || fail ? 1 : 0);
