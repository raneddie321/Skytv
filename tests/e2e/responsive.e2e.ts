import { expect, test } from '@playwright/test';
import { freshStart } from './helpers';

const VIEWPORTS = [
  { name: '4K', width: 3840, height: 2160 },
  { name: '1080p', width: 1920, height: 1080 },
  { name: '768p', width: 1366, height: 768 },
  { name: '720p', width: 1280, height: 720 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const vp of VIEWPORTS) {
  test(`no horizontal overflow and readable text at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const path of ['/', '/tv/demo%3Atv%3Akingsgate', '/live', '/settings']) {
      await freshStart(page, 'p-emma', path);
      await page.waitForTimeout(800);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(1);
      const minFont = await page.evaluate(() => {
        let min = Infinity;
        document.querySelectorAll('h1, h2, p, span, button').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || !el.textContent?.trim() || r.bottom < 0 || r.top > innerHeight) return;
          min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
        });
        return min;
      });
      // TV text scales with the screen; never below ~10px on small windows, larger on TVs.
      expect(minFont).toBeGreaterThanOrEqual(vp.width >= 1920 ? 13 : 10);
    }
  });
}
