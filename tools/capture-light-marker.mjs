import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765';
const OUT = process.env.OUT_DIR || '/opt/cursor/artifacts';

async function waitScene(page) {
  await page.waitForFunction(() => typeof window.__lightMarkerDebug === 'function', { timeout: 15000 });
  await page.waitForTimeout(900);
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
  await page.waitForTimeout(600);
}

function analyze(buf) {
  const png = PNG.sync.read(buf);
  const cw = png.width;
  const ch = png.height;
  const topH = Math.floor(ch * 0.12);
  const hudMargin = cw >= 1100 ? 380 : 0;
  const idx = (x, y) => (y * png.width + x) << 2;
  let topYellow = 0;
  let bodyYellow = 0;
  for (let y = 0; y < ch; y++) {
    for (let x = 40; x < cw - 40 - hudMargin; x++) {
      const i = idx(x, y);
      const r = png.data[i]; const g = png.data[i + 1]; const b = png.data[i + 2];
      const isYellow = g > 150 && r > 170 && b < 170 && (r + g) > (b + 220);
      if (!isYellow) continue;
      if (y < topH) topYellow++;
      else bodyYellow++;
    }
  }
  return { topYellow, bodyYellow };
}

const shots = [
  {
    key: 'in-frame',
    file: 'light-in-frame-az60-el35-dist4.png',
    opts: { enDalton: true, type: 2, showLight: true, az: 60, el: 35, lightDist: 4, light: 'blanca' },
    expectVisible: true,
    expectYellowMin: 200
  },
  {
    key: 'off-screen',
    file: 'light-offscreen-el85-az0-dist12.png',
    opts: { enDalton: false, showLight: true, az: 0, el: 85, lightDist: 12, light: 'blanca' },
    expectVisible: false,
    expectYellowMax: 50
  },
  {
    key: 'user-sodio',
    file: 'light-user-az75-el75-sodio.png',
    opts: { enDalton: true, type: 2, showLight: true, az: 75, el: 75, lightDist: 4, light: 'sodio' },
    expectVisible: true,
    expectYellowMin: 200
  },
  {
    key: 'occluded',
    file: 'light-occluded-orbit-bus.png',
    opts: { enDalton: false, showLight: true, az: 60, el: 35, lightDist: 4, light: 'blanca' },
    orbitDrag: true,
    expectVisible: true,
    expectYellowMax: 80,
    note: 'luz en frustum; cámara orbitada: bus interponiéndose → texDepth descarta marca'
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
  if (s.orbitDrag) {
    const box = await page.locator('#gl').boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.45);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.45, { steps: 24 });
      await page.mouse.up();
      await page.waitForTimeout(800);
    }
  }
  await waitScene(page);
  const dbg = await page.evaluate(() => window.__lightMarkerDebug());
  const path = `${OUT}/${s.file}`;
  await page.locator('#gl').screenshot({ path });
  const ana = analyze(await readFile(path));
  const row = {
    ...s,
    ...dbg,
    ndc: dbg.ndc?.map((v) => +v.toFixed(4)),
    uLightPos: dbg.uLightPos?.map((v) => +v.toFixed(4)),
    eye: dbg.eye?.map((v) => +v.toFixed(4)),
    ...ana
  };
  let fail = false;
  if (s.expectVisible === true && !dbg.visible) fail = true;
  if (s.expectVisible === false && dbg.visible) fail = true;
  const yellowTotal = ana.bodyYellow + ana.topYellow;
  if (s.expectYellowMin != null && yellowTotal < s.expectYellowMin) fail = true;
  if (s.expectYellowMax != null && yellowTotal > s.expectYellowMax) fail = true;
  if (s.expectBodyYellowMin != null && ana.bodyYellow < s.expectBodyYellowMin) fail = true;
  if (s.expectBodyYellowMax != null && ana.bodyYellow > s.expectBodyYellowMax) fail = true;
  row.yellowTotal = yellowTotal;
  row.fail = fail;
  report.push(row);
  console.log(s.key, 'ndc', row.ndc, 'vis', dbg.visible, 'yellow', ana.bodyYellow, fail ? 'FAIL' : 'OK');
}

await writeFile(`${OUT}/light-marker-report.json`, JSON.stringify(report, null, 2));
await browser.close();
if (logs.length) { console.error(logs.join('\n')); process.exit(1); }
if (report.some((r) => r.fail)) process.exit(1);
