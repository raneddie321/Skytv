# Implementation checklist

Status of the requirements in the original brief. ✅ done · ⚠️ done with a documented limitation · ⏳ remaining for production.

## Setup & architecture
- ✅ React + TypeScript + Vite, React Router, Zustand, TanStack Query, CSS Modules design system
- ✅ hls.js (lazy-loaded) with native-HLS / progressive fallbacks
- ✅ Typed service contracts, mock/remote `DATA_MODE`, OpenAPI contract with examples, reference mock server
- ✅ TMDB proxy (key server-side), `.env.example`, bundle secret check
- ✅ Vitest unit tests, Playwright e2e tests and screenshot capture

## Navigation
- ✅ Custom spatial focus manager: sections, layers, screen memory, focus recovery, scroll-follow, key repeat throttle
- ✅ Browser, Android TV, Tizen and webOS key adapters; Tizen key registration; Android `tvback` bridge event
- ✅ Back behaviour throughout; Backspace as optional Back; media keys; channel up/down; digit entry
- ✅ Centred pill navigation bar with white focus/selected pill

## Screens
- ✅ Profile selection, create/edit/delete, persisted selection
- ✅ Home: hero, Continue Watching (persisted progress, up-next), Trending, Popular Movies/TV, Sky Originals, Recommended, Recently Added, My List
- ✅ Live TV: channel browser with preview, Now & Next, full EPG, categories, favourites, live player, direct channel entry (demo data)
- ✅ TV Shows, genres, simple series detail with large episode tiles, season selection, resume/next episode
- ✅ Movies, movie detail, watchlist, sample playback, recommendations
- ✅ Sky Originals (configuration-driven)
- ✅ Search: on-screen keyboard, physical typing, real-time results, recent searches
- ✅ Watchlist per profile
- ✅ Kids: pastel theme, large tiles, kids search, kids filtering, parent PIN to leave / open settings
- ✅ Settings: profiles, language, subtitles, playback, accessibility, parental controls (PIN), account, network diagnostics, app info
- ✅ Apps launcher (⚠️ launching third-party apps needs native platform integration)

## Player
- ✅ HTML5 video, HLS, play/pause, seek, volume/mute, fullscreen, subtitles (WebVTT), progress persistence, resume, start over, next episode / up-next, back to details, remote keys, auto-hiding controls, heartbeat/end session
- ⚠️ Uses a generated, labelled sample video; ⏳ DRM (Widevine/PlayReady/FairPlay) and platform players (ExoPlayer, AVPlay, webOS) are documented integration points

## Quality
- ✅ Lazy routes, lazy images with preloading of nearby cards, query caching, service-worker image cache, skeletons, error/retry states, offline banner, TMDB fallback notice, reduced motion, high-contrast focus, larger text
- ✅ Responsive: 4K, 1080p, 1366×768, 720p, tablet, mobile (automated overflow/readability checks)

## Remaining for production (⏳)
- Real identity, entitlements, EPG, live streams and DRM from licensed providers
- Platform wrappers/packages and store certification (Android TV, Tizen, webOS) — see PLATFORM_PACKAGING.md
- Server-enforced parental controls and territory-specific ratings
- Licensed Sky brand assets (placeholders are used; see `src/config/brand.ts`)
- Localisation beyond English, analytics/QoE telemetry, crash reporting
- Verification against live TMDB from an environment with network access (this repository's screenshots use the offline demo catalog)
