# Sky Stream Demo — Smart TV streaming app

A Sky-inspired streaming application built for televisions: 10-foot UI, full remote-control navigation, live TV
with an EPG, series/movie browsing, a working player, profiles, Kids mode and a backend-ready service layer.

> **Independent demo.** Not affiliated with, endorsed by, or an official product of Sky UK Ltd. The "sky" wordmark is
> a text placeholder configured in `src/config/brand.ts` — replace it with licensed assets if you have them.
> Live TV channels, schedules and the offline catalog are fictional. Playback uses a generated, labelled sample video.

![Contact sheet](screenshots/contact-sheet.png)

See **[screenshots/INDEX.md](screenshots/INDEX.md)** for every screenshot (captured from the running app with Playwright).

## Quick start

```bash
npm install
cp .env.example .env           # then set TMDB_API_KEY=<your key>
npm run dev                    # http://localhost:5173  (TMDB proxy + mock API included)
```

Use the arrow keys, **Enter** (OK) and **Escape**/**Backspace** (Back). Everything works without a mouse.
Demo parent PIN: **1234**.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with the TMDB proxy (`/api/tmdb`) and reference mock API (`/api/v1`) |
| `npm run build` | Typecheck, production build (`dist/`), server bundle (`dist-server/`), check the TMDB key is not in the bundle |
| `npm start` | Production server: static app + TMDB proxy + mock API on `PORT` (default 8080) |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright end-to-end tests (starts a dev server with the offline catalog) |
| `npm run screenshots` | Captures all screenshots into `screenshots/` and builds the contact sheet + index |
| `npm run demo-assets` | Regenerates the offline catalog artwork and the sample video (needs ffmpeg) |

Playwright uses the Chromium it finds via `PLAYWRIGHT_BROWSERS_PATH`, or run `npx playwright install chromium`.

### Configuration (`.env`)

| Variable | Scope | Default | Meaning |
|---|---|---|---|
| `TMDB_API_KEY` | server only | — | TMDB v3 key used by the proxy. Never shipped to the browser. |
| `DATA_MODE` | client | `mock` | `mock`: everything works on-device. `remote`: all services use the REST API. |
| `CATALOG_SOURCE` | client | `tmdb` | `tmdb` (falls back to the offline catalog with a visible notice when TMDB is unreachable) or `fixtures` |
| `API_BASE_URL` | client | `/api/v1` | REST API base for `DATA_MODE=remote` |
| `TMDB_PROXY_URL` | client | `/api/tmdb` | Where the browser reaches the TMDB proxy |
| `ENABLE_MOCK_API` | server | `true` | Serve the reference mock REST API |
| `PORT` | server | `8080` | Production server port |

## What's implemented

- **Profiles** — "Who's watching?", create/edit/delete with on-screen keyboard and avatars, Kids profiles, persisted selection.
- **Home** — cinematic rotating hero, Continue Watching (real progress, "Up next" after a finished episode), Trending,
  Popular movies/TV, Sky Originals, Recommended for you, Recently added, My List.
- **Live TV** — channel browser with large programme preview, Now & Next tiles, full EPG grid with a live "now" line,
  categories, favourites, direct channel-number entry, live player with channel up/down. *Demo data, clearly labelled.*
- **TV Shows / Movies** — featured hero, genre filter with infinite grid, rails per genre; deliberately simple series
  page where the resume/next/first episode is the focused large tile; seasons; cast; "More like this".
- **Sky Originals** — curated from `src/config/originals.ts`; badges never inferred from TMDB.
- **Search** — TV keyboard + physical typing, debounced real-time results, recent searches.
- **My List** — per-profile watchlist.
- **Kids** — bright pastel theme, big tiles, kids channels, simplified navigation, kids search, rating filter, PIN to
  leave Kids or open Settings.
- **Player** — HLS (native or hls.js), progressive fallback, play/pause, seek bar, ±10 s, volume/mute, subtitles,
  fullscreen, resume/start over, next episode with "Up next" countdown, auto-hiding controls, progress persistence,
  playback session heartbeat.
- **Settings** — profiles, language, subtitles (with preview), playback, accessibility (reduce motion, high contrast,
  larger text), parental controls behind the PIN, account placeholder with device-code sign-in, network diagnostics,
  app information.
- **Resilience** — skeletons, per-row error/retry, offline banner, TMDB → offline catalog fallback, image fallbacks,
  focus recovery; no blank screens.

## Architecture

```
src/
  api/            contracts (domain + service interfaces), TMDB client/mappers, offline fixtures,
                  mock services, remote REST adapters, TanStack Query hooks, remote sync
  navigation/     spatial focus manager, geometry, key mapping (browser/Android TV/Tizen/webOS), React bindings
  player/         playback engine (source selection, hls.js, fallbacks)
  state/          zustand stores: profiles, library (watchlist/progress/searches/favourites), settings, status
  design/         tokens + global styles (rem-based scaling: 1rem = 20px @1080p, 40px @4K)
  components/     cards, rails, grid, hero, dialogs, PIN pad, on-screen keyboard, …
  layout/         app shell, navigation bar, banners
  screens/        one folder per screen (lazy-loaded routes)
  config/         env, brand assets, originals curation, avatars
server/           TMDB proxy, reference mock REST API, production server
docs/             API contract, backend integration, remote mapping, platform packaging, checklist
tests/            unit (Vitest) and e2e + screenshots (Playwright)
scripts/          demo artwork renderer, sample video generator, contact sheet, bundle secret check
```

Further reading:
- [docs/BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md) — service contracts, remote mode, sync, TMDB proxy
- [docs/api/openapi.yaml](docs/api/openapi.yaml) — REST API contract with examples
- [docs/TV_REMOTE_MAPPING.md](docs/TV_REMOTE_MAPPING.md) — key codes per platform and focus behaviour
- [docs/PLATFORM_PACKAGING.md](docs/PLATFORM_PACKAGING.md) — Android TV, Tizen and webOS requirements
- [docs/CHECKLIST.md](docs/CHECKLIST.md) — implementation checklist and remaining production work

## Data sources

- **TMDB** provides metadata and artwork (trending, popular, top rated, genres, search, details, seasons,
  episodes, cast) through the proxy. *This product uses the TMDB API but is not endorsed or certified by TMDB.*
- **Offline demo catalog** (`src/api/fixtures/`) — 47 fictional titles with procedurally generated artwork
  (`scripts/demo-art/`), deterministic seasons/episodes/cast. Used for `CATALOG_SOURCE=fixtures`, as the TMDB fallback,
  by the mock API, by the tests and for the screenshots.
- **Sample video** — generated by `scripts/make-sample-video.sh` (ffmpeg test signal, WebM VP9 + HLS H.264, English
  and French WebVTT), labelled "SAMPLE VIDEO" on screen and in the player UI.

## Remaining production requirements

Real identity/entitlements/EPG/live streams and DRM from licensed providers; native platform wrappers and store
certification; server-enforced parental controls; licensed brand assets; localisation; analytics. Details in
[docs/CHECKLIST.md](docs/CHECKLIST.md) and [docs/PLATFORM_PACKAGING.md](docs/PLATFORM_PACKAGING.md).
