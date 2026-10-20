import { expect, test } from '@playwright/test';
import { expectFocus, focusedId, freshStart, navigateTo, press } from './helpers';

test.describe('remote-control navigation', () => {
  test('selects a profile with the keyboard only', async ({ page }) => {
    await freshStart(page, null, '/');
    await expect(page).toHaveURL(/\/profiles$/);
    await expectFocus(page, 'profile:p-emma');
    await press(page, 'ArrowRight');
    await expectFocus(page, 'profile:p-noah');
    await press(page, 'ArrowLeft');
    await press(page, 'Enter');
    await expect(page.getByTestId('home')).toBeVisible();
    await expectFocus(page, /^home-hero:play$/);
    // persisted across reload
    await page.reload();
    await expect(page.getByTestId('home')).toBeVisible();
  });

  test('moves between hero, rows and the navigation bar', async ({ page }) => {
    await freshStart(page, 'p-emma', '/');
    await expectFocus(page, 'home-hero:play');
    await press(page, 'ArrowRight');
    await expectFocus(page, 'home-hero:info');
    await press(page, 'ArrowDown');
    await expectFocus(page, /^home-trending:/);
    const first = await focusedId(page);
    await press(page, 'ArrowRight', 6);
    const deep = await focusedId(page);
    expect(deep).not.toBe(first);
    // the focused card is scrolled into view
    await expect
      .poll(async () => {
        const box = await page.locator(`[data-focus-id="${deep}"]`).boundingBox();
        return box!.x + box!.width;
      })
      .toBeLessThanOrEqual(1920);
    await press(page, 'ArrowDown');
    await expectFocus(page, /^home-movies:/);
    await press(page, 'ArrowUp');
    await expectFocus(page, deep!); // row remembers its position
    await navigateTo(page, 'ArrowUp', /^nav:/);
    await expectFocus(page, 'nav:home');
    await press(page, 'ArrowRight', 3);
    await expectFocus(page, 'nav:movies');
    await press(page, 'Enter');
    await expect(page).toHaveURL(/\/movies$/);
    await expect(page.getByTestId('browse-movie')).toBeVisible();
  });

  test('Back moves to the nav bar, then Home; focus is restored after visiting details', async ({ page }) => {
    await freshStart(page, 'p-emma', '/tv');
    await expectFocus(page, 'tv-hero:play');
    await press(page, 'ArrowDown', 2);
    await expectFocus(page, /^tv-popular:/);
    await press(page, 'ArrowRight', 2);
    const card = await focusedId(page);
    await press(page, 'Enter');
    await expect(page.getByTestId('series-detail')).toBeVisible();
    await expectFocus(page, /^ep:/);
    await press(page, 'Escape');
    await expect(page.getByTestId('browse-tv')).toBeVisible();
    await expectFocus(page, card!);
    await press(page, 'Escape');
    await expectFocus(page, /^nav:/);
    await press(page, 'Escape');
    await expect(page).toHaveURL(/\/$/);
    await expectFocus(page, 'home-hero:play');
    await press(page, 'Backspace'); // optional Back shortcut: Home content → nav bar
    await expectFocus(page, /^nav:/);
  });

  test('every focusable on Home is reachable without a mouse and focus never disappears', async ({ page }) => {
    await freshStart(page, 'p-emma', '/');
    await expectFocus(page, 'home-hero:play');
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowLeft']) {
      await press(page, key);
      expect(await focusedId(page)).not.toBeNull();
    }
    const focusVisible = await page.evaluate(() => getComputedStyle(document.activeElement!.querySelector('div') ?? document.activeElement!).boxShadow);
    expect(focusVisible).toContain('rgb(255, 255, 255)');
  });
});
