# Platform packaging & compatibility

The deliverable today is a TV-optimised **web application** (Vite build in `dist/`) plus a small Node server
(`dist-server/index.mjs`) that serves it, proxies TMDB and optionally hosts the reference mock API. A web build does
**not** automatically run on every TV OS — each platform needs a wrapper/package, store certification and
platform-specific playback, DRM and key handling. This document lists what is required.

## Browser engine baseline

The build targets **Chromium 87 / Safari 14** (`build.target` in `vite.config.ts`). The CSS uses flexbox `gap`,
`aspect-ratio`, `clamp()/min()` and CSS custom properties.

| Platform | Engine | Supported by this build |
|---|---|---|
| Android TV / Google TV (WebView, auto-updated) | Chromium 100+ | Yes |
| LG webOS 22+ (webOS 7) | Chromium 87+ | Yes |
| LG webOS 6 (2021) | Chromium 79 | No — needs `@vitejs/plugin-legacy` + `aspect-ratio`/`gap` fallbacks |
| Samsung Tizen 6.5+ (2021+) | Chromium 85+ | Mostly; `aspect-ratio` needs Chromium 88 → add padding-top fallback for 2021 models |
| Samsung Tizen 7+ (2022+) | Chromium 94+ | Yes |
| Older Tizen/webOS | Chromium ≤ 76 | No — requires a legacy build and CSS fallbacks |

Verify on real devices: performance characteristics (GPU compositing, memory, decoding) differ greatly from desktop.

## Common requirements

- Serve over HTTPS from a stable origin, or package the static files inside the app (recommended for start-up time).
- `TMDB_API_KEY` must stay server-side. Packaged apps call the deployed proxy (`TMDB_PROXY_URL=https://…/api/tmdb`) and,
  in remote mode, the backend (`API_BASE_URL`). Configure CORS on those services for the packaged app origin.
- Disable the service worker for packaged builds if the platform restricts it (Tizen/webOS packaged apps load from
  `file://`); image caching then relies on the HTTP cache.
- Respect TV safe areas (the layout keeps ~5% horizontal margins) and test at 1280×720, 1920×1080 and 3840×2160.

## Android TV / Google TV

- Wrap in a native app with a `WebView` (or Trusted Web Activity for a PWA-style deployment).
- Manifest: `android.software.leanback` feature, `LEANBACK_LAUNCHER` intent filter, 320×180 banner, `touchscreen required=false`.
- Forward `KEYCODE_BACK` to the page (`tvback` event, see TV_REMOTE_MAPPING.md); exit only from the profile screen.
- Media keys arrive via `MediaSession` — forward them or let WebView's default key events reach the page.
- Playback: hls.js works in WebView for H.264/AAC. For DRM (Widevine) and better 4K/HDR, use ExoPlayer/Media3 natively
  and bridge play/pause/seek/progress over a JS interface; `PlayerEngine` is the integration seam.
- Enable `WebSettings.setMediaPlaybackRequiresUserGesture(false)` for autoplay.

## Samsung Tizen

- Package as a Tizen web app (`.wgt`) with Tizen Studio / `tizen package`. `config.xml` needs:
  `<tizen:application required_version="6.5" …/>`, privileges `tv.inputdevice`, `internet`, `tv.audio` as needed,
  `<tizen:setting screen-orientation="landscape"/>`.
- Key registration is performed at start-up via `tizen.tvinputdevice.registerKeyBatch` (already implemented).
- Back key 10009: on the profile screen call `tizen.application.getCurrentApplication().exit()`.
- Playback: native `<video>` supports HLS; for DRM, 4K/HDR and reliable live streams use **AVPlay** (`webapis.avplay`).
  Implement an `AVPlayEngine` alongside `PlayerEngine` and select it when `detectPlatform() === 'tizen'`.
- Samsung Smart TV Seller Office certification: performance (cold start < 10 s on reference devices), Back behaviour,
  remote coverage, no mouse-only UI.

## LG webOS

- Package with the webOS TV SDK (`ares-package`) — `appinfo.json` with `"resolution": "1920x1080"`, `"disableBackHistoryAPI": true`
  to receive Back (461) as a key event, and an icon/large icon/splash.
- Magic Remote pointer: supported (hover follows real pointer movement, click selects). Listen to `cursorStateChange`
  if you want to hide focus rings while the pointer is visible.
- Playback: native `<video>` supports HLS; DRM via the Luna media pipeline / `mediaOption` on the `<video>` source.
- LG Seller Lounge QA: Back key behaviour, exit dialog conventions, 4K UI scaling.

## Playback, DRM & live streams (all platforms)

- `PlaybackService.createSession` returns `StreamSource[]` with optional `drm` (Widevine/PlayReady/FairPlay license
  URL + headers). `PlayerEngine.playMethodFor` currently refuses DRM sources so that a missing integration fails
  safely. Integrate EME (Shaka Player) for web/Android, AVPlay for Tizen and the webOS media pipeline for LG.
- Report heartbeats (`heartbeat`) and end sessions (`endSession`) for concurrency control — already wired.
- Real live channels require authorised stream URLs, entitlements and EPG feeds from licensed providers. The demo
  channels, schedules and sample video in this repository are fictional placeholders.

## Accessibility

- Respect system "reduce motion" (and the in-app setting); TV OS screen readers (Samsung Voice Guide, LG Audio Guidance,
  Android TalkBack) read DOM focus and ARIA labels — every focusable has a label. Validate with each screen reader.
