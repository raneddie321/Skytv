import { expect, test } from '@playwright/test';
import { expectFocus, focusedId, freshStart, navigateTo, press, remoteKey } from './helpers';

test.describe('core flows', () => {
  test('Home → series → episode → sample playback → Home shows Continue Watching', async ({ page }) => {
    await freshStart(page, 'p-emma', '/');
    await expect(page.getByTestId('rail-home-cw')).toHaveCount(0);
    await expectFocus(page, 'home-hero:play');
    await press(page, 'ArrowRight'); // More info
    await press(page, 'Enter');
    await expect(page.getByTestId('series-detail')).toBeVisible();
    await expectFocus(page, 'ep:1:1');
    await press(page, 'ArrowRight');
    await expectFocus(page, 'ep:1:2');
    await press(page, 'Enter');

    const player = page.getByTestId('player');
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute('data-playing', 'true', { timeout: 15_000 });
    await expect(page.getByText('S1 E2 · The Ferryman')).toBeVisible();
    await expect(page.getByText('Sample video')).toBeVisible();
    await page.waitForTimeout(3500);

    await press(page, 'Escape'); // back to details
    await expect(page.getByTestId('series-detail')).toBeVisible();
    await expectFocus(page, 'ep:1:2'); // focus restored to the episode
    await expect(page.locator('[data-focus-id="ep:1:2"]')).toContainText('Resume');
    await press(page, 'Escape');
    await expect(page.getByTestId('home')).toBeVisible();

    const cw = page.getByTestId('rail-home-cw');
    await expect(cw).toBeVisible();
    await expect(cw.getByTestId('media-card').first()).toHaveAttribute('aria-label', /Kingsgate, S1 E2/);
    // progress survives a reload
    await page.reload();
    await expect(page.getByTestId('rail-home-cw')).toBeVisible();
  });

  test('switches seasons and selects an episode', async ({ page }) => {
    await freshStart(page, 'p-emma', '/tv/demo%3Atv%3Akingsgate');
    await expectFocus(page, 'ep:1:1');
    await press(page, 'ArrowUp');
    await expectFocus(page, 'season:1');
    await press(page, 'ArrowRight');
    await expectFocus(page, 'season:2');
    await press(page, 'Enter');
    await expect(page).toHaveURL(/season=2/);
    await expect(page.locator('[data-focus-id="ep:2:1"]')).toBeVisible();
    await press(page, 'ArrowDown');
    await expectFocus(page, /^ep:2:/);
    await navigateTo(page, 'ArrowRight', /^ep:2:3$/);
    await press(page, 'Enter');
    await expect(page.getByTestId('player')).toBeVisible();
    await expect(page.getByText(/^S2 E3 · /)).toBeVisible();
  });

  test('watchlist add/remove persists per profile', async ({ page }) => {
    await freshStart(page, 'p-emma', '/movies/demo%3Amovie%3Aember-city');
    await expectFocus(page, 'movie:play');
    await navigateTo(page, 'ArrowRight', /^movie:list$/);
    await press(page, 'Enter');
    await expect(page.locator('[data-focus-id="movie:list"]')).toContainText('In My List');
    await page.reload();
    await page.goto('/watchlist');
    await expect(page.getByTestId('grid-watchlist').getByTestId('media-card')).toHaveCount(1);
    await expectFocus(page, 'watchlist:demo:movie:ember-city');
    await press(page, 'Enter');
    await expect(page.getByTestId('movie-detail')).toBeVisible();

    // a different profile has its own list
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('skytv.profiles')!);
      p.state.activeProfileId = 'p-noah';
      localStorage.setItem('skytv.profiles', JSON.stringify(p));
    });
    await page.goto('/watchlist');
    await expect(page.getByText('Nothing saved yet.')).toBeVisible();
  });

  test('search with the on-screen keyboard and a physical keyboard', async ({ page }) => {
    await freshStart(page, 'p-emma', '/search');
    await expectFocus(page, 'osk:a');
    // type "so" on the on-screen keyboard: s is row 4 col 1, o is row 3 col 3
    await press(page, 'ArrowDown', 3);
    await expectFocus(page, 'osk:s');
    await press(page, 'Enter');
    await press(page, 'ArrowUp');
    await press(page, 'ArrowRight', 2);
    await expectFocus(page, 'osk:o');
    await press(page, 'Enter');
    await expect(page.getByTestId('search-query')).toContainText('so');
    await page.keyboard.type('lar');
    await expect(page.getByTestId('search-query')).toContainText('solar');
    const results = page.getByTestId('grid-search-results');
    await expect(results.getByTestId('media-card').first()).toHaveAttribute('aria-label', /Solar Drift/);
    await navigateTo(page, 'ArrowRight', /^search-results:/);
    await press(page, 'Enter');
    await expect(page.getByTestId('movie-detail')).toBeVisible();
    await press(page, 'Escape');
    await expect(page.getByTestId('search-query')).toContainText('solar'); // query kept
    await page.goto('/search');
    await expect(page.getByText('Recent searches')).toBeVisible();
  });

  test('Live TV: channels, favourites, Now & Next, full guide and live playback', async ({ page }) => {
    await freshStart(page, 'p-emma', '/live');
    await expectFocus(page, 'ch:meridian-one');
    await expect(page.getByTestId('channel-101')).toContainText(/\d\d:\d\d – \d\d:\d\d/);
    await press(page, 'ArrowDown');
    await expectFocus(page, 'ch:meridian-drama');
    await press(page, 'ArrowRight');
    await expectFocus(page, 'fav:meridian-drama');
    await press(page, 'Enter');
    await expect(page.getByTestId('fav-102')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('live-cat-favourites').click();
    await expect(page.getByTestId('channel-102')).toBeVisible();
    await expect(page.getByTestId('channel-101')).toHaveCount(0);
    await page.getByTestId('live-cat-all').click();

    await page.getByTestId('live-tab-now-next').click();
    await expect(page.getByTestId('live-now-next')).toBeVisible();
    await expect(page.getByTestId('now-next-tile').first()).toContainText('Next');

    await page.getByTestId('live-tab-guide').click();
    await expect(page.getByTestId('epg')).toBeVisible();
    await expectFocus(page, /^epg:meridian-one:/);
    const start = await focusedId(page);
    await press(page, 'ArrowRight');
    expect(await focusedId(page)).not.toBe(start);
    await press(page, 'ArrowDown');
    await expectFocus(page, /^epg:meridian-drama:/);
    await press(page, 'ArrowLeft', 4);
    await press(page, 'Enter'); // on-air programme → live player (or info dialog for others)
    const dialog = page.getByTestId('dialog-programme');
    if (await dialog.isVisible()) await press(page, 'Escape');

    await page.goto('/live');
    await expectFocus(page, 'ch:meridian-one');
    await press(page, 'Enter');
    await expect(page.getByTestId('player')).toBeVisible();
    await expect(page.getByText('Live', { exact: true })).toBeVisible();
    await expect(page.getByText('101 Meridian One')).toBeVisible();
    await press(page, 'PageUp'); // channel up
    await expect(page.getByText('102 Meridian Drama')).toBeVisible();
  });

  test('player controls: pause, seek, subtitles, auto-hide', async ({ page }) => {
    await freshStart(page, 'p-emma', '/watch/movie/demo%3Amovie%3Asolar-drift');
    const player = page.getByTestId('player');
    await expect(player).toHaveAttribute('data-playing', 'true', { timeout: 15_000 });
    await expectFocus(page, 'player:play');
    await press(page, 'Enter');
    await expect(player).toHaveAttribute('data-playing', 'false');
    const t0 = await page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime);
    await press(page, 'ArrowUp');
    await expectFocus(page, 'player:seek');
    await press(page, 'ArrowRight', 2);
    await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(t0 + 15);
    await press(page, 'ArrowLeft');
    await press(page, 'ArrowDown');
    await navigateTo(page, 'ArrowRight', /^player:subs$/);
    await press(page, 'Enter');
    await expect(page.getByTestId('dialog-subtitles')).toBeVisible();
    await navigateTo(page, 'ArrowDown', /^subs:en$/);
    await press(page, 'Enter');
    await expect(page.getByTestId('dialog-subtitles')).toHaveCount(0);
    await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => Array.from(v.textTracks).find((t) => t.mode === 'showing')?.language)).toBe('en');
    await remoteKey(page, 'MediaPlayPause');
    await expect(player).toHaveAttribute('data-playing', 'true');
    await page.waitForTimeout(4800);
    await expect(player).not.toHaveClass(/controlsOn/);
    await press(page, 'Escape');
    await expect(page.getByTestId('player')).toHaveCount(0);
  });

  test('Kids: filtered content and a PIN gate to leave', async ({ page }) => {
    await freshStart(page, 'p-kids', '/');
    await expect(page).toHaveURL(/\/kids$/);
    await expect(page.getByTestId('kids-home')).toBeVisible();
    await expect(page.getByText('Kingsgate')).toHaveCount(0);
    await page.goto('/movies'); // adult routes redirect back to Kids
    await expect(page).toHaveURL(/\/kids$/);
    await page.getByTestId('kids-exit').click();
    await expect(page.getByTestId('dialog-pin')).toBeVisible();
    await page.keyboard.type('0000');
    await expect(page.getByText('Incorrect PIN. Try again.')).toBeVisible();
    await page.keyboard.type('1234');
    await expect(page.getByTestId('dialog-pin')).toHaveCount(0);
    await expect(page.getByTestId('profile-select')).toBeVisible();
  });
});
