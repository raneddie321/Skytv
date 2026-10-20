/**
 * Renders the offline demo artwork into public/demo-art using headless Chromium.
 *   npx tsx scripts/demo-art/render.ts [--only=<slug>]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_TITLES } from '../../src/api/fixtures/titles';
import { PROGRAMME_ART } from '../../src/api/fixtures/live';
import { STILLS_PER_SERIES } from '../../src/api/fixtures/catalog';
import { hashString } from '../../src/api/fixtures/random';
import { AVATARS } from '../../src/config/avatars';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(root, 'public/demo-art');
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

interface Job {
  file: string;
  width: number;
  height: number;
  spec: Record<string, unknown>;
  variant: { kind: string; index: number };
  quality: number;
}

const jobs: Job[] = [];
for (const t of DEMO_TITLES) {
  if (only && t.slug !== only) continue;
  const spec = { ...t.art, seed: hashString(t.slug) };
  const dir = `titles/${t.slug}`;
  jobs.push({ file: `${dir}/backdrop.webp`, width: 1920, height: 1080, spec, variant: { kind: 'backdrop', index: 0 }, quality: 0.8 });
  jobs.push({ file: `${dir}/poster.webp`, width: 600, height: 900, spec, variant: { kind: 'poster', index: 0 }, quality: 0.8 });
  if (t.type === 'tv') {
    for (let i = 1; i <= STILLS_PER_SERIES; i++) {
      jobs.push({ file: `${dir}/still-${i}.webp`, width: 960, height: 540, spec, variant: { kind: 'still', index: i }, quality: 0.78 });
    }
  }
}
if (!only) {
  for (const [key, art] of Object.entries(PROGRAMME_ART)) {
    jobs.push({
      file: `programmes/${key}.webp`,
      width: 1280,
      height: 720,
      spec: { ...art, figure: 'none', seed: hashString(key) },
      variant: { kind: 'programme', index: 0 },
      quality: 0.8,
    });
  }
  for (const a of AVATARS) {
    jobs.push({
      file: `avatars/${a.id}.webp`,
      width: 400,
      height: 400,
      spec: { palette: a.palette, creatures: a.creature ? [a.creature] : undefined, seed: hashString(a.id) },
      variant: { kind: 'avatar', index: 0 },
      quality: 0.85,
    });
  }
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body style="margin:0;background:#000"></body></html>');
await page.addScriptTag({ path: path.join(here, 'painter.js') });

let bytes = 0;
for (const job of jobs) {
  const dataUrl = await page.evaluate(({ width, height, spec, variant, quality }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    (window as unknown as { paintArt: (c: HTMLCanvasElement, s: unknown, v: unknown) => void }).paintArt(canvas, spec, variant);
    return canvas.toDataURL('image/webp', quality);
  }, job);
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  const file = path.join(out, job.file);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, buf);
  bytes += buf.length;
}
await browser.close();
console.log(`Rendered ${jobs.length} images (${(bytes / 1024 / 1024).toFixed(1)} MB) into ${path.relative(root, out)}`);
