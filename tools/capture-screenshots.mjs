import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
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
  await page.waitForTimeout(1200);
}

async function setCond(page, opts) {
  await page.evaluate((o) => {
    const set = (id, v) => {
      const e = document.getElementById(id);
      if (!e) return;
      if (e.type === 'checkbox') e.checked = !!v;
      else e.value = String(v);
      e.dispatchEvent(new Event(e.type === 'checkbox' ? 'change' : 'input'));
    };
    Object.keys(o).forEach((k) => set(k, o[k]));
  }, opts);
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
  const idx = (x, y) => (y * png.width + x) << 2;
  for (let y = 1; y < ch - 1; y++) {
    for (let x = 1; x < cw - 1; x++) {
      const i = idx(x, y);
      const r = png.data[i]; const g = png.data[i + 1]; const b = png.data[i + 2];
      if (g > 175 && r > 200 && b < 140 && x < cw - 380) {
        yellow++;
        const score = g + r - b;
        if (score > yellowMax.g + yellowMax.r - yellowMax.b) yellowMax = { r, g, b, x, y };
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
  return {
    yellowPx: yellow,
    marker: yellowMax.r > 200 ? `${quad(yellowMax.x, yellowMax.y)} (~${yellowMax.x},${yellowMax.y})` : 'no detectado',
    blurScore: Math.round(lap / ((cw - 2) * (ch - 2)))
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

const shots = [
  { file: 'shot-default-light-marker.png', opts: { view: 'sim', enDalton: true, enMyopia: false, enAstigma: false, type: 2, az: 60, el: 35, showLight: true } },
  { file: 'shot-myopia-only.png', opts: { view: 'sim', enDalton: false, enMyopia: true, enAstigma: false, myopiaD: 5, showLight: true } },
  { file: 'shot-astigmatism-only.png', opts: { view: 'sim', enDalton: false, enMyopia: false, enAstigma: true, showLight: true } },
  { file: 'shot-dalton-myopia.png', opts: { view: 'sim', enDalton: true, enMyopia: true, enAstigma: false, type: 2, myopiaD: 4, order: 'optica-color', showLight: true } },
  { file: 'shot-order-color-optica.png', opts: { view: 'sim', enDalton: true, enMyopia: true, enAstigma: false, type: 2, myopiaD: 4, order: 'color-optica', showLight: true } },
  { file: 'shot-light-az0-el35.png', opts: { view: 'sim', enDalton: true, enMyopia: true, myopiaD: 4, order: 'color-optica', az: 0, el: 35, showLight: true } },
  { file: 'shot-light-az90-el35.png', opts: { view: 'sim', enDalton: true, az: 90, el: 35, showLight: true } },
  { file: 'shot-light-az180-el35.png', opts: { view: 'sim', enDalton: true, az: 180, el: 35, showLight: true } },
  { file: 'shot-light-az270-el35.png', opts: { view: 'sim', enDalton: true, az: 270, el: 35, showLight: true } },
  { file: 'shot-light-az60-el10.png', opts: { view: 'sim', enDalton: true, enMyopia: true, myopiaD: 4, order: 'color-optica', az: 60, el: 10, showLight: true } },
  { file: 'shot-light-az60-el80.png', opts: { view: 'sim', enDalton: true, az: 60, el: 80, showLight: true } }
];

const report = [];
for (const s of shots) {
  await setCond(page, s.opts);
  await waitScene(page);
  const path = `${OUT}/${s.file}`;
  await page.screenshot({ path, fullPage: false });
  const buf = await readFile(path);
  const ana = analyzePng(buf);
  const sum = await summary(page);
  report.push({ file: s.file, summary: sum, ...ana });
  console.log(s.file, ana, sum.slice(0, 60));
}

console.log(JSON.stringify(report, null, 2));
if (logs.length) console.error('console errors:', logs.join('\n'));
const badMarker = report.filter((r) => r.yellowPx < 80);
const badMyopia = report.filter((r) => r.file.includes('myopia') || r.file.includes('color-optica') || (r.file.includes('az0') || r.file.includes('el10')) && r.opts);
await browser.close();
process.exit(logs.length || badMarker.length ? 1 : 0);
