import { expect, type Page } from '@playwright/test';

export const PROFILES = {
  state: {
    profiles: [
      { id: 'p-emma', name: 'Emma', avatarId: 'dusk', kind: 'adult', createdAt: '2025-01-01T00:00:00.000Z' },
      { id: 'p-noah', name: 'Noah', avatarId: 'ocean', kind: 'adult', createdAt: '2025-01-01T00:00:00.000Z' },
      { id: 'p-daniel', name: 'Daniel', avatarId: 'slate', kind: 'adult', createdAt: '2025-01-01T00:00:00.000Z' },
      { id: 'p-kids', name: 'Kids', avatarId: 'kids-bloop', kind: 'kids', createdAt: '2025-01-01T00:00:00.000Z' },
    ],
    activeProfileId: null as string | null,
  },
  version: 1,
};

/** Starts from a clean device; optionally with an active profile. */
export async function freshStart(page: Page, activeProfileId: string | null = null, path = '/') {
  await page.goto('/profiles');
  await page.evaluate((data) => {
    localStorage.clear();
    localStorage.setItem('skytv.profiles', JSON.stringify(data));
  }, { ...PROFILES, state: { ...PROFILES.state, activeProfileId } });
  await page.goto(path);
}

export const focusedId = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('data-focus-id') ?? null);

export async function expectFocus(page: Page, matcher: string | RegExp) {
  await expect.poll(() => focusedId(page), { timeout: 8000 }).toMatch(matcher);
}

export async function press(page: Page, key: string, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(60);
  }
}

/** Moves focus with arrows until `focus` matches, failing after `max` presses. */
export async function navigateTo(page: Page, key: string, matcher: RegExp, max = 20) {
  for (let i = 0; i < max; i++) {
    if (matcher.test((await focusedId(page)) ?? '')) return;
    await press(page, key);
  }
  await expectFocus(page, matcher);
}

/** Dispatches a TV remote key that Playwright's keyboard doesn't know (e.g. MediaPlayPause, keyCode 10252 on Tizen). */
export async function remoteKey(page: Page, key: string, keyCode = 0) {
  await page.evaluate(([k, c]) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k as string, keyCode: c as number, bubbles: true })), [key, keyCode]);
  await page.waitForTimeout(60);
}
