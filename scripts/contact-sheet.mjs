/**
 * Builds screenshots/contact-sheet.png and screenshots/INDEX.md from screenshots/manifest.json
 * (written by tests/e2e/screenshots.spec.ts). Uses Playwright's Chromium to lay out the sheet.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve('screenshots');
const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

const tiles = manifest
  .map((m, i) => {
    const data = readFileSync(path.join(dir, m.file)).toString('base64');
    return `<figure><div class="frame"><img src="data:image/png;base64,${data}"></div><figcaption><b>${String(i + 1).padStart(2, '0')}</b> ${m.title}<span>${m.viewport}</span></figcaption></figure>`;
  })
  .join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 48px; background: #0b0c10; color: #fff; font-family: Inter, system-ui, sans-serif; }
  h1 { margin: 0 0 6px; font-size: 34px; } p { margin: 0 0 32px; color: #9aa0ab; font-size: 17px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px 22px; }
  figure { margin: 0; }
  .frame { aspect-ratio: 16 / 9; background: #000; border-radius: 10px; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 1px #262a33; }
  img { max-width: 100%; max-height: 100%; object-fit: contain; }
  figcaption { margin-top: 10px; font-size: 16px; color: #d8dbe2; display: flex; gap: 8px; align-items: baseline; }
  figcaption b { color: #6f9bff; } figcaption span { margin-left: auto; color: #7d8390; font-size: 13px; white-space: nowrap; }
</style></head><body>
<h1>Sky Stream Demo — screenshot contact sheet</h1>
<p>${manifest.length} screenshots captured with Playwright from the running application (offline demo catalog, generated artwork, sample video).</p>
<div class="grid">${tiles}</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2400, height: 1200 } });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: path.join(dir, 'contact-sheet.png'), fullPage: true });
await browser.close();

const index = [
  '# Screenshot index',
  '',
  'Captured by `npm run screenshots` (Playwright, `tests/e2e/screenshots.spec.ts`) against the running app with',
  '`CATALOG_SOURCE=fixtures` (offline demo catalog: fictional titles and locally generated artwork). Playback shows the',
  'generated, clearly labelled sample video.',
  '',
  '![Contact sheet](contact-sheet.png)',
  '',
  '| # | Screen | Viewport | Route | File |',
  '|---|--------|----------|-------|------|',
  ...manifest.map((m, i) => `| ${i + 1} | ${m.title} | ${m.viewport} | \`${m.route}\` | [${m.file}](${m.file}) |`),
  '',
].join('\n');
writeFileSync(path.join(dir, 'INDEX.md'), index);
console.log(`Contact sheet and index written for ${manifest.length} screenshots.`);
