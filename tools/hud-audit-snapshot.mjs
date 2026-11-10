import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765';
const OUT = process.env.OUT_DIR || '/opt/cursor/artifacts';
const BOTON_ID = 19;

async function waitScene(page) {
  await page.waitForFunction(() => {
    const s = document.getElementById('summary');
    return s && /\d+ de \d+ objetos/.test(s.textContent) && !s.textContent.includes('0 de 0');
  }, { timeout: 20000 });
  await page.waitForTimeout(1200);
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

async function pickBoton(page) {
  await page.evaluate((id) => {
    window.__auditState && (window.__auditState.selected = id);
  }, BOTON_ID).catch(() => {});
  await page.evaluate((id) => {
    const s = { selected: id, dirty: true };
    if (typeof window.__forceAudit === 'function') window.__forceAudit(s);
  }, BOTON_ID).catch(() => {});
}

const scenarios = [
  { key: 'default', label: 'Default (deutan, D65)', opts: { view: 'sim', enDalton: true, type: 2, enMyopia: false, enAstigma: false, light: 'blanca' } },
  { key: 'dalton-off-d65', label: 'Daltonismo apagado, D65', opts: { view: 'sim', enDalton: false, enMyopia: false, enAstigma: false, light: 'blanca' } },
  { key: 'dalton-off-sodio', label: 'Daltonismo apagado, sodio', opts: { view: 'sim', enDalton: false, enMyopia: false, enAstigma: false, light: 'sodio' } },
  { key: 'deutan', label: 'Deutan', opts: { view: 'sim', enDalton: true, type: 2, enMyopia: false, enAstigma: false, light: 'blanca' } },
  { key: 'deutan-myopia-optica-color', label: 'Deutan + miopía 4D, óptica→color', opts: { view: 'sim', enDalton: true, type: 2, enMyopia: true, myopiaD: 4, enAstigma: false, order: 'optica-color', light: 'blanca' } },
  { key: 'deutan-myopia-color-optica', label: 'Deutan + miopía 4D, color→óptica', opts: { view: 'sim', enDalton: true, type: 2, enMyopia: true, myopiaD: 4, enAstigma: false, order: 'color-optica', light: 'blanca' } }
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

const rows = [];
for (const sc of scenarios) {
  await setCond(page, sc.opts);
  await waitScene(page);
  const data = await page.evaluate((botonId) => {
    const summary = document.getElementById('summary')?.textContent || '';
    const m = summary.match(/(\d+) de (\d+)/);
    const pairs = summary.match(/(\d+) pares/);
    const audit = window.__auditData || {};
    const rec = audit[botonId];
    const type = Number(document.getElementById('type')?.value || 2);
    const dE = rec?.metrics?.[type]?.dE;
    return { summary, fail: m ? Number(m[1]) : null, total: m ? Number(m[2]) : null, pairs: pairs ? Number(pairs[1]) : null, botonDe: dE };
  }, BOTON_ID);
  await page.screenshot({ path: `${OUT}/hud-${sc.key}.png`, fullPage: false });
  rows.push({ ...sc, ...data });
  console.log(sc.key, data.summary);
}

await writeFile(`${OUT}/hud-audit-snapshot.json`, JSON.stringify(rows, null, 2));
await browser.close();
if (logs.length) {
  console.error('console errors:', logs.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify(rows, null, 2));
