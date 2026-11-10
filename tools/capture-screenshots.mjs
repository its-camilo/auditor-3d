import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765';
const OUT = process.env.OUT_DIR || '/opt/cursor/artifacts';

async function waitScene(page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('fps');
    return el && el.textContent && !el.textContent.includes('0 fps');
  }, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function setCond(page, opts) {
  await page.evaluate((o) => {
    const set = (id, v) => { const e = document.getElementById(id); if (!e) return; if (e.type === 'checkbox') e.checked = !!v; else e.value = String(v); e.dispatchEvent(new Event(e.type === 'checkbox' ? 'change' : 'input')); };
    if ('view' in o) set('view', o.view);
    if ('enDalton' in o) set('enDalton', o.enDalton);
    if ('enMyopia' in o) set('enMyopia', o.enMyopia);
    if ('enAstigma' in o) set('enAstigma', o.enAstigma);
    if ('order' in o) set('order', o.order);
    if ('myopiaD' in o) set('myopiaD', o.myopiaD);
    if ('type' in o) set('type', o.type);
  }, opts);
}

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist'
  ]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push(String(e)));

await mkdir(OUT, { recursive: true });

const shots = [
  { file: 'shot-default-light-marker.png', opts: { view: 'sim', enDalton: true, enMyopia: false, enAstigma: false, type: 2 } },
  { file: 'shot-myopia-only.png', opts: { view: 'sim', enDalton: false, enMyopia: true, enAstigma: false, myopiaD: 5 } },
  { file: 'shot-astigmatism-only.png', opts: { view: 'sim', enDalton: false, enMyopia: false, enAstigma: true } },
  { file: 'shot-dalton-myopia.png', opts: { view: 'sim', enDalton: true, enMyopia: true, enAstigma: false, type: 2, myopiaD: 4 } },
  { file: 'shot-order-color-optica.png', opts: { view: 'sim', enDalton: true, enMyopia: true, enAstigma: false, order: 'color-optica', type: 2, myopiaD: 4 } }
];

await page.goto(BASE, { waitUntil: 'networkidle' });
const failed = [];
for (const s of shots) {
  await setCond(page, s.opts);
  await waitScene(page);
  await page.screenshot({ path: `${OUT}/${s.file}`, fullPage: false });
  console.log('saved', s.file);
}

const res = await page.evaluate(async () => {
  const paths = ['shaders/miopia.frag', 'shaders/astigmatismo.frag', 'shaders/daltonismo.frag', 'shaders/marcaluz.frag'];
  const r = await Promise.all(paths.map(async (p) => ({ p, ok: (await fetch(p)).ok })));
  return r;
});
console.log('fetch', JSON.stringify(res));
if (logs.length) console.error('console errors:', logs.join('\n'));
await browser.close();
process.exit(logs.length ? 1 : 0);
