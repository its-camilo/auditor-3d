import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765';
const OUT = process.env.OUT_DIR || '/opt/cursor/artifacts';

async function waitScene(page) {
  await page.waitForFunction(() => {
    const s = document.getElementById('summary');
    return s && /\d+ de \d+ objetos/.test(s.textContent);
  }, { timeout: 20000 });
  await page.waitForTimeout(1000);
}

async function setCond(page, opts) {
  await page.evaluate((o) => {
    const set = (id, v) => {
      const e = document.getElementById(id);
      if (!e) return;
      if (e.type === 'checkbox') e.checked = !!v;
      else e.value = String(v);
      e.dispatchEvent(new Event('input'));
      e.dispatchEvent(new Event('change'));
    };
    Object.keys(o).forEach((k) => set(k, o[k]));
  }, opts);
  await page.waitForTimeout(500);
}

function analyze(buf, w = 1280, h = 800) {
  const png = PNG.sync.read(buf);
  const cw = Math.min(w, png.width);
  const ch = Math.min(h, png.height);
  const topH = Math.floor(ch * 0.12);
  const idx = (x, y) => (y * png.width + x) << 2;
  let topYellow = 0;
  let bodyYellow = 0;
  let topMax = { x: 0, y: 0, score: 0 };
  for (let y = 0; y < ch; y++) {
    for (let x = 80; x < cw - 80; x++) {
      const i = idx(x, y);
      const r = png.data[i]; const g = png.data[i + 1]; const b = png.data[i + 2];
      const isYellow = g > 175 && r > 200 && b < 140;
      if (!isYellow) continue;
      const score = g + r - b;
      if (y < topH) {
        topYellow++;
        if (score > topMax.score) topMax = { x, y, score };
      } else if (x < cw - 380) bodyYellow++;
    }
  }
  return { topYellow, bodyYellow, topMax };
}

const shots = [
  {
    file: 'light-user-az75-el75-sodio.png',
    opts: { enDalton: true, type: 2, showLight: true, az: 75, el: 75, lightDist: 4, light: 'sodio' },
    expect: 'marca 3D en escena, sin flecha en franja superior'
  },
  {
    file: 'light-offscreen-az180-el10.png',
    opts: { enDalton: true, type: 2, showLight: true, az: 180, el: 10, lightDist: 4, light: 'blanca' },
    expect: 'sin indicador de borde; sin triángulo amarillo'
  },
  {
    file: 'light-offscreen-el85-az0.png',
    opts: { enDalton: false, showLight: true, az: 0, el: 85, lightDist: 12, light: 'blanca' },
    note: 'luz casi cenital y lejos: fuera del frustum visible, sin marca'
  }
];

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

const report = [];
for (const s of shots) {
  await setCond(page, s.opts);
  await waitScene(page);
  const path = `${OUT}/${s.file}`;
  await page.screenshot({ path, fullPage: false });
  const ana = analyze(await readFile(path));
  const failEdge = ana.topYellow > 35;
  report.push({ ...s, ...ana, failEdge });
  console.log(s.file, 'topYellow', ana.topYellow, 'bodyYellow', ana.bodyYellow, failEdge ? 'FAIL edge' : 'OK');
}

await writeFile(`${OUT}/light-marker-report.json`, JSON.stringify(report, null, 2));
await browser.close();
if (logs.length) { console.error(logs.join('\n')); process.exit(1); }
if (report.some((r) => r.failEdge)) process.exit(1);
