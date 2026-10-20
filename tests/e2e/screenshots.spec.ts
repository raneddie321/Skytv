/**
 * Captures real screenshots of the running app into /screenshots and writes screenshots/manifest.json
 * (consumed by scripts/contact-sheet.mjs). Run: npm run screenshots
 */
import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { focusedId, navigateTo, press, PROFILES, remoteKey } from './helpers';

const OUT = path.resolve('screenshots');
mkdirSync(OUT, { recursive: true });
const manifest: { file: string; title: string; viewport: string; route: string }[] = [];

const now = Date.now();
const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();
const media = (id: string, type: 'tv' | 'movie', title: string, slug: string, titleStyle: string) => ({
  id,
  type,
  title,
  titleStyle,
  backdropUrl: `/demo-art/titles/${slug}/backdrop.webp`,
  posterUrl: `/demo-art/titles/${slug}/poster.webp`,
});
const kingsgate = media('demo:tv:kingsgate', 'tv', 'Kingsgate', 'kingsgate', 'wide');
const iron = media('demo:tv:iron-meridian', 'tv', 'Iron Meridian', 'iron-meridian', 'condensed');
const harbour = media('demo:tv:the-harbourmaster', 'tv', 'The Harbourmaster', 'the-harbourmaster', 'serif');
const ember = media('demo:movie:ember-city', 'movie', 'Ember City', 'ember-city', 'condensed');
const blue = media('demo:tv:blue-hour', 'tv', 'Blue Hour', 'blue-hour', 'serif');
const pip = { ...media('demo:tv:pip-and-the-puddle-pals', 'tv', 'Pip & the Puddle Pals', 'pip-and-the-puddle-pals', 'sans'), kidsSafe: true };
const ep = (slug: string, s: number, e: number, title: string, still: number) => ({
  id: `demo:tv:${slug}:s${s}e${e}`,
  seasonNumber: s,
  episodeNumber: e,
  title,
  stillUrl: `/demo-art/titles/${slug}/still-${still}.webp`,
});

const LIBRARY = {
  state: {
    byProfile: {
      'p-emma': {
        watchlist: [harbour, media('demo:movie:solar-drift', 'movie', 'Solar Drift', 'solar-drift', 'wide'), media('demo:tv:northbound', 'tv', 'Northbound', 'northbound', 'serif'), media('demo:movie:summit', 'movie', 'Summit', 'summit', 'wide'), media('demo:tv:hollow-pines', 'tv', 'Hollow Pines', 'hollow-pines', 'wide'), media('demo:movie:paper-moons', 'movie', 'Paper Moons', 'paper-moons', 'serif')],
        progress: {
          a: { key: 'episode:demo:tv:kingsgate:1:3', media: kingsgate, episode: ep('kingsgate', 1, 3, 'Low Tide', 3), positionSec: 1400, durationSec: 3300, completed: false, updatedAt: iso(30) },
          b: { key: 'episode:demo:tv:iron-meridian:1:5', media: iron, episode: ep('iron-meridian', 1, 5, 'The Long Dark', 1), positionSec: 2000, durationSec: 3100, completed: false, updatedAt: iso(300) },
          c: { key: 'movie:demo:movie:ember-city', media: ember, positionSec: 2600, durationSec: 7400, completed: false, updatedAt: iso(900) },
          d: { key: 'episode:demo:tv:blue-hour:1:4', media: blue, episode: ep('blue-hour', 1, 4, 'Ghosts', 2), positionSec: 1300, durationSec: 1800, completed: false, updatedAt: iso(2000) },
          e: { key: 'episode:demo:tv:the-harbourmaster:1:2', media: harbour, episode: ep('the-harbourmaster', 1, 2, 'The Lantern', 4), nextEpisode: ep('the-harbourmaster', 1, 3, 'Undercurrent', 1), positionSec: 3300, durationSec: 3300, completed: true, updatedAt: iso(3000) },
        },
        recentSearches: ['harbour', 'solar drift', 'crime'],
        favouriteChannels: ['meridian-drama', 'vista-premiere', 'discover-earth'],
      },
      'p-kids': {
        watchlist: [pip],
        progress: {
          k: { key: 'episode:demo:tv:pip-and-the-puddle-pals:1:2', media: pip, episode: ep('pip-and-the-puddle-pals', 1, 2, 'Dancing Daisies', 2), positionSec: 300, durationSec: 660, completed: false, updatedAt: iso(60) },
        },
        recentSearches: [],
        favouriteChannels: [],
      },
    },
  },
  version: 1,
};

async function seed(page: Page, active: string | null, route: string) {
  await page.goto('/profiles');
  await page.evaluate(
    ({ profiles, library }) => {
      localStorage.clear();
      localStorage.setItem('skytv.profiles', JSON.stringify(profiles));
      localStorage.setItem('skytv.library', JSON.stringify(library));
    },
    { profiles: { ...PROFILES, state: { ...PROFILES.state, activeProfileId: active } }, library: LIBRARY },
  );
  await page.goto(route);
}

/** Waits for visible images to finish loading and animations to settle. */
async function settle(page: Page, ms = 900) {
  await page.waitForTimeout(ms);
  await page.evaluate(async () => {
    const imgs = Array.from(document.images).filter((i) => {
      const r = i.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    });
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => ((i.onload = r), (i.onerror = r))))));
  });
  await page.waitForTimeout(400);
}

async function shot(page: Page, file: string, title: string) {
  await settle(page);
  const vp = page.viewportSize()!;
  await page.screenshot({ path: path.join(OUT, file) });
  manifest.push({ file, title, viewport: `${vp.width}×${vp.height}`, route: new URL(page.url()).pathname + new URL(page.url()).search });
}

const sized = (page: Page, w: number, h: number) => page.setViewportSize({ width: w, height: h });

test.describe.configure({ mode: 'serial' });

test('capture screenshots', async ({ page }) => {
  test.setTimeout(600_000);

  // ---------------------------------------------------------------- 1080p primary target
  await sized(page, 1920, 1080);
  await seed(page, null, '/profiles');
  await shot(page, '01-profile-selection.png', 'Profile selection');

  await seed(page, 'p-emma', '/');
  await page.waitForSelector('[data-testid="home"]');
  await navigateTo(page, 'ArrowUp', /^nav:/);
  await navigateTo(page, 'ArrowDown', /^home-hero:/);
  await shot(page, '02-home.png', 'Adult Home with cinematic hero');

  await navigateTo(page, 'ArrowUp', /^nav:/);
  await press(page, 'ArrowRight', 3);
  await shot(page, '03-home-navigation-focus.png', 'Home with navigation bar focus (Movies)');

  await press(page, 'ArrowDown'); // returns to hero
  await navigateTo(page, 'ArrowDown', /^home-cw:/);
  await shot(page, '04-continue-watching.png', 'Continue Watching row with progress');

  await navigateTo(page, 'ArrowDown', /^home-trending:/);
  await press(page, 'ArrowRight', 2);
  await shot(page, '05-trending.png', 'Trending on Sky row');

  await navigateTo(page, 'ArrowDown', /^home-originals:/);
  await shot(page, '06-home-originals-row.png', 'Home: Sky Originals and further rows');

  await seed(page, 'p-emma', '/live');
  await page.waitForSelector('[data-testid="channel-101"]');
  await press(page, 'ArrowDown', 1);
  await shot(page, '07-live-tv-channels.png', 'Live TV channel browser with programme preview');

  await page.goto('/live/guide');
  await page.waitForSelector('[data-testid="epg"]');
  await page.waitForTimeout(800);
  await press(page, 'ArrowDown', 2);
  await press(page, 'ArrowRight');
  await shot(page, '08-live-tv-guide.png', 'Full electronic programme guide (EPG)');

  await page.goto('/live/now-next');
  await page.waitForSelector('[data-testid="now-next-tile"]');
  await shot(page, '09-live-tv-now-next.png', 'Live TV Now & Next');

  await seed(page, 'p-emma', '/tv');
  await page.waitForSelector('[data-testid="browse-tv"]');
  await shot(page, '10-tv-shows.png', 'TV Shows');

  await page.goto('/tv?genre=crime');
  await page.waitForSelector('[data-testid="grid-tv-genre-grid"]');
  await shot(page, '11-tv-genre.png', 'TV Shows filtered by genre');

  await page.goto('/tv/demo%3Atv%3Akingsgate');
  await page.waitForSelector('[data-testid="episode-row"]');
  await shot(page, '12-series-detail.png', 'Series detail — resume episode first');

  await press(page, 'ArrowUp');
  await press(page, 'ArrowRight');
  await shot(page, '13-season-selection.png', 'Season selection');

  await press(page, 'Enter');
  await page.waitForSelector('[data-focus-id="ep:2:1"]');
  await press(page, 'ArrowDown');
  await press(page, 'ArrowRight', 2);
  await shot(page, '14-episode-selection.png', 'Episode selection (Season 2)');

  await seed(page, 'p-emma', '/movies');
  await page.waitForSelector('[data-testid="browse-movie"]');
  await press(page, 'ArrowDown', 2);
  await shot(page, '15-movies.png', 'Movies');

  await page.goto('/movies/demo%3Amovie%3Aember-city');
  await page.waitForSelector('[data-testid="movie-detail"]');
  await shot(page, '16-movie-detail.png', 'Movie detail with resume');

  await page.goto('/originals');
  await page.waitForSelector('[data-testid="originals"]');
  await shot(page, '17-sky-originals.png', 'Sky Originals (configuration-driven)');

  await page.goto('/search');
  await page.waitForSelector('[data-testid="osk"]');
  await shot(page, '18-search.png', 'Search with on-screen keyboard and recent searches');

  await page.keyboard.type('the');
  await page.waitForTimeout(600);
  await navigateTo(page, 'ArrowRight', /^search-results:/, 8);
  await shot(page, '19-search-results.png', 'Real-time search results');

  await page.goto('/watchlist');
  await page.waitForSelector('[data-testid="grid-watchlist"]');
  await shot(page, '20-watchlist.png', 'My List (watchlist)');

  await page.goto('/watch/episode/demo%3Atv%3Akingsgate/1/3');
  await page.waitForSelector('[data-testid="player"][data-playing="true"]', { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await press(page, 'ArrowUp');
  await shot(page, '21-video-player.png', 'Video player (sample video, controls visible)');

  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await page.waitForSelector('[data-testid="player"][data-playing="false"]');
  await shot(page, '22-player-paused.png', 'Player paused');

  await page.locator('video').evaluate((v: HTMLVideoElement) => (v.currentTime = v.duration - 9));
  await remoteKey(page, 'MediaPlayPause');
  await page.waitForSelector('[data-testid="player-upnext"]');
  await shot(page, '23-player-up-next.png', 'Player — Up next episode');

  await page.goto('/watch/channel/meridian-drama');
  await page.waitForSelector('[data-testid="player"][data-playing="true"]', { timeout: 20_000 });
  await press(page, 'ArrowUp');
  await shot(page, '24-live-player.png', 'Live channel playback with programme info');

  await seed(page, 'p-kids', '/kids');
  await page.waitForSelector('[data-testid="kids-home"]');
  await shot(page, '25-kids-home.png', 'Kids Home');

  await page.goto('/kids/title/tv/demo%3Atv%3Apip-and-the-puddle-pals');
  await page.waitForSelector('[data-testid="episode-row"]');
  await press(page, 'ArrowUp', 2);
  await shot(page, '26-kids-series-detail.png', 'Kids series detail');

  await navigateTo(page, 'ArrowDown', /^ep:/);
  await press(page, 'ArrowRight', 2);
  await shot(page, '27-kids-episodes.png', 'Kids episodes with large tiles');

  await page.goto('/kids/search');
  await page.waitForSelector('[data-testid="osk"]');
  await page.keyboard.type('b');
  await shot(page, '28-kids-search.png', 'Kids search');

  await page.goto('/kids');
  await page.waitForSelector('[data-testid="kids-home"]');
  await page.getByTestId('kids-exit').click();
  await page.waitForSelector('[data-testid="dialog-pin"]');
  await page.keyboard.type('12');
  await shot(page, '29-kids-parent-pin.png', 'Parent PIN gate to leave Kids');

  await seed(page, 'p-emma', '/settings');
  await page.waitForSelector('[data-testid="settings"]');
  await shot(page, '30-settings.png', 'Settings — profiles');

  await page.goto('/settings/playback');
  await press(page, 'ArrowRight');
  await shot(page, '31-settings-playback.png', 'Settings — playback preferences');

  await page.goto('/settings/network');
  await page.waitForTimeout(1500);
  await shot(page, '32-settings-network.png', 'Settings — network diagnostics');

  await page.goto('/settings/parental');
  await page.waitForSelector('[data-testid="settings"]');
  await page.getByTestId('settings-parental').click();
  await page.waitForSelector('[data-testid="dialog-pin"]');
  await shot(page, '33-settings-parental-pin.png', 'Settings — parental controls PIN');

  await page.goto('/settings/about');
  await shot(page, '34-settings-about.png', 'Settings — app information');

  await page.goto('/profiles/p-noah/edit');
  await page.waitForSelector('[data-testid="profile-edit"]');
  await shot(page, '35-profile-edit.png', 'Edit profile');

  await page.goto('/apps');
  await page.waitForSelector('[data-testid="apps"]');
  await shot(page, '36-apps.png', 'Apps');

  // ---------------------------------------------------------------- other resolutions
  await sized(page, 1280, 720);
  await seed(page, 'p-emma', '/');
  await page.waitForSelector('[data-testid="home"]');
  await shot(page, '40-home-720p.png', 'Home at 1280×720');
  await page.goto('/live/guide');
  await page.waitForSelector('[data-testid="epg"]');
  await shot(page, '41-guide-720p.png', 'TV Guide at 1280×720');

  await sized(page, 1366, 768);
  await page.goto('/tv/demo%3Atv%3Akingsgate');
  await page.waitForSelector('[data-testid="episode-row"]');
  await shot(page, '42-series-1366x768.png', 'Series detail at 1366×768');

  await sized(page, 3840, 2160);
  await page.goto('/');
  await page.waitForSelector('[data-testid="home"]');
  await shot(page, '43-home-4k.png', 'Home at 3840×2160 (4K)');
  await page.goto('/tv/demo%3Atv%3Akingsgate');
  await page.waitForSelector('[data-testid="episode-row"]');
  await shot(page, '44-series-4k.png', 'Series detail at 4K');
  await page.goto('/live');
  await page.waitForSelector('[data-testid="channel-101"]');
  await shot(page, '45-live-4k.png', 'Live TV at 4K');

  await sized(page, 1024, 768);
  await page.goto('/');
  await page.waitForSelector('[data-testid="home"]');
  await shot(page, '46-tablet.png', 'Tablet 1024×768');

  await sized(page, 390, 844);
  await page.goto('/');
  await page.waitForSelector('[data-testid="home"]');
  await shot(page, '47-mobile-home.png', 'Mobile responsive Home (390×844)');
  await page.goto('/tv/demo%3Atv%3Akingsgate');
  await page.waitForSelector('[data-testid="episode-row"]');
  await shot(page, '48-mobile-series.png', 'Mobile series detail');

  writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`captured ${manifest.length} screenshots; last focus ${await focusedId(page)}`);
});
