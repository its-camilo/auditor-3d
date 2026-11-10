import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

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
    };
    Object.keys(o).forEach((k) => set(k, o[k]));
  }, opts);
}

async function summary(page) {
  return page.evaluate(() => document.getElementById('summary')?.textContent || '');
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
  { file: 'shot-default-light-marker.png', opts: { view: 'sim', enDalton: true, enMyopia: false, enAstigma: false, type: 2, az: 60, el: 35 } },
  { file: 'shot-myopia-only.png', opts: { view: 'sim', enDalton: false, enMyopia: true, enAstigma: false, myopiaD: 5 } },
  { file: 'shot-astigmatism-only.png', opts: { view: 'sim', enDalton: false, enMyopia: false, enAstigma: true } },
  { file: 'shot-dalton-myopia.png', opts: { view: 'sim', enDalton: true, enMyopia: true, enAstigma: false, type: 2, myopiaD: 4, order: 'optica-color' } },
  { file: 'shot-order-color-optica.png', opts: { view: 'sim', enDalton: true, enMyopia: true, enAstigma: false, type: 2, myopiaD: 4, order: 'color-optica' } },
  { file: 'shot-light-az0-el35.png', opts: { view: 'sim', enDalton: true, az: 0, el: 35, showLight: true } },
  { file: 'shot-light-az90-el35.png', opts: { view: 'sim', enDalton: true, az: 90, el: 35, showLight: true } },
  { file: 'shot-light-az180-el35.png', opts: { view: 'sim', enDalton: true, az: 180, el: 35, showLight: true } },
  { file: 'shot-light-az270-el35.png', opts: { view: 'sim', enDalton: true, az: 270, el: 35, showLight: true } },
  { file: 'shot-light-az60-el10.png', opts: { view: 'sim', enDalton: true, az: 60, el: 10, showLight: true } },
  { file: 'shot-light-az60-el80.png', opts: { view: 'sim', enDalton: true, az: 60, el: 80, showLight: true } }
];

const auditChecks = [];
for (const s of shots) {
  await setCond(page, s.opts);
  await waitScene(page);
  await page.screenshot({ path: `${OUT}/${s.file}`, fullPage: false });
  const sum = await summary(page);
  auditChecks.push({ file: s.file, summary: sum });
  console.log('saved', s.file, '|', sum.slice(0, 80));
}

const res = await page.evaluate(async () => {
  const paths = ['shaders/miopia.frag', 'shaders/astigmatismo.frag', 'shaders/daltonismo.frag', 'shaders/marcaluz.frag'];
  return Promise.all(paths.map(async (p) => ({ p, ok: (await fetch(p)).ok })));
});
console.log('fetch', JSON.stringify(res));
console.log('auditChecks', JSON.stringify(auditChecks, null, 2));
if (logs.length) console.error('console errors:', logs.join('\n'));
const zero = auditChecks.filter((c) => c.summary.includes('0 de 0'));
if (zero.length) console.error('audit zero objects:', zero.map((z) => z.file));
await browser.close();
process.exit(logs.length || zero.length ? 1 : 0);
