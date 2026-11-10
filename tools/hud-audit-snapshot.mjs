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
  await page.waitForFunction(() => window.__auditData && Object.keys(window.__auditData).length >= 10, { timeout: 15000 });
  await page.waitForTimeout(800);
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

const scenarios = [
  { key: 'default', label: 'Default (deutan, D65)', opts: { enDalton: true, type: 2, enMyopia: false, enAstigma: false, light: 'blanca' } },
  { key: 'dalton-off-d65', label: 'Daltonismo apagado, D65', opts: { enDalton: false, enMyopia: false, enAstigma: false, light: 'blanca' } },
  { key: 'dalton-off-sodio', label: 'Daltonismo apagado, sodio', opts: { enDalton: false, enMyopia: false, enAstigma: false, light: 'sodio' } },
  { key: 'deutan', label: 'Deutan', opts: { enDalton: true, type: 2, enMyopia: false, enAstigma: false, light: 'blanca' } },
  { key: 'deutan-myopia-optica-color', label: 'Deutan + miopía 4D, óptica→color', opts: { enDalton: true, type: 2, enMyopia: true, myopiaD: 4, enAstigma: false, order: 'optica-color', light: 'blanca' } },
  { key: 'deutan-myopia-color-optica', label: 'Deutan + miopía 4D, color→óptica', opts: { enDalton: true, type: 2, enMyopia: true, myopiaD: 4, enAstigma: false, order: 'color-optica', light: 'blanca' } }
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
    const mi = typeof window.__metricsIndex === 'function' ? window.__metricsIndex() : 0;
    const dE = rec?.metrics?.[mi]?.dE;
    const heatFails = typeof window.__heatmapFailCount === 'function' ? window.__heatmapFailCount() : null;
    const fails = [];
    if (typeof window.__metricsIndex === 'function') {
      Object.keys(audit).forEach((k) => {
        const st = audit[k].status?.[mi];
        if (st === 2) fails.push(Number(k));
      });
    }
    return {
      summary, fail: m ? Number(m[1]) : null, total: m ? Number(m[2]) : null,
      pairs: pairs ? Number(pairs[1]) : null, botonDe: dE, metricsIndex: mi,
      heatmapFailOrConf: heatFails, failIds: fails
    };
  }, BOTON_ID);
  await page.screenshot({ path: `${OUT}/hud-${sc.key}.png`, fullPage: false });
  rows.push({ ...sc, ...data });
  console.log(sc.key, data.summary, 'heatmapΔ', data.heatmapFailOrConf, 'botonDe', data.botonDe?.toFixed(4));
}

await writeFile(`${OUT}/hud-audit-snapshot.json`, JSON.stringify(rows, null, 2));
await browser.close();
if (logs.length) {
  console.error('console errors:', logs.join('\n'));
  process.exit(1);
}
const badHeat = rows.find((r) => r.key === 'dalton-off-d65' && r.heatmapFailOrConf > 0);
const badSync = rows.find((r) => r.fail !== r.heatmapFailOrConf);
if (badHeat || badSync) {
  console.error('FAIL heatmap/sync', badHeat?.key, badSync && `${badSync.key} summary=${badSync.fail} heat=${badSync.heatmapFailOrConf}`);
  process.exit(1);
}
console.log(JSON.stringify(rows, null, 2));
