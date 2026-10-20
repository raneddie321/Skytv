# Backend integration

The UI depends only on the typed service contracts in `src/api/contracts/` (`domain.ts`, `services.ts`).
Implementations are chosen at build time by `src/api/index.ts`:

| `DATA_MODE` | Catalog | Personal data, live TV, playback, auth |
|---|---|---|
| `mock` (default) | `CATALOG_SOURCE=tmdb` → TMDB via the proxy, falling back to the offline demo catalog on network failure (with a visible notice); `CATALOG_SOURCE=fixtures` → offline demo catalog only | On-device mock services (`src/api/mock/services.ts`): zustand stores persisted in `localStorage`, fixture channels/EPG, sample video |
| `remote` | REST (`/catalog/*`) | REST (`src/api/remote/services.ts`) |

The REST contract is specified in **[`docs/api/openapi.yaml`](api/openapi.yaml)** with request/response examples.
`server/mockApi.ts` is a reference implementation of that contract backed by the demo catalog; it is mounted at
`/api/v1` by `npm run dev` and `npm start` (disable with `ENABLE_MOCK_API=false`). `tests/unit/remoteContract.test.ts`
runs the real remote adapters against it, so the client, contract and reference server stay in sync.

## Switching to a real backend

1. Implement the endpoints in `openapi.yaml` (or put an adapter/BFF in front of existing services).
2. Build with `DATA_MODE=remote API_BASE_URL=https://api.example.com/v1`.
3. Enable CORS for the TV app origin(s) and allow the `Authorization` header.
4. Authentication: the client uses the device-code flow (`POST /auth/device`, poll `POST /auth/device/token`,
   `202` while pending). The access token is stored in `localStorage` (`skytv.auth.token`) and sent as a bearer token.
   On TV platforms, prefer the platform's secure storage via the native wrapper.

## Services

| Contract | Purpose | Notes |
|---|---|---|
| `AuthService` | Session, device sign-in, sign-out | TV-friendly code entry on another device |
| `AccountService`, `SubscriptionService` | Household account, plan & packs | Shown in Settings › Account |
| `ProfileService` | Profile CRUD (max 6) | UI goes through `src/state/profileActions.ts` |
| `CatalogService` | Rails, featured, genres, movie/series/season details, editorial collections | Ids are opaque strings |
| `SearchService` | Text search with audience filter | `audience=kids` must return only kids-safe titles |
| `RecommendationService` | Personalised rows & "More like this" | Seeds = recent history + watchlist |
| `WatchHistoryService` | Progress records per profile | Upserted every 5 s while playing, on pause/seek/exit |
| `WatchlistService` | My List per profile | Idempotent add/remove |
| `LiveTvService`, `EpgService` | Channel line-up and schedule windows | Client requests ~7 h windows aligned to 30 min |
| `PlaybackService` | Creates authorised playback sessions with stream URLs, subtitles, DRM | Heartbeat + end session for concurrency |
| `EntitlementService` | Checks rights before playback | `entitled=false` shows an upgrade message |
| `ParentalControlsService` | PIN verification/change, kids rating limit, PIN for 18 | **Must be enforced server-side** |

## Synchronisation (remote mode)

`src/api/sync.ts` keeps the on-device stores (instant UI, offline tolerance) in sync with the backend:

- on start: profiles are loaded from `GET /profiles`;
- on profile selection: watchlist and history are hydrated from the API;
- on change: watchlist additions/removals and progress updates are pushed (fire-and-forget, failures are retried on
  the next change). For production add a retry queue persisted across restarts.

## TMDB

- The browser calls `/api/tmdb/*`; `server/tmdbProxy.ts` forwards to `https://api.themoviedb.org/3` with
  `TMDB_API_KEY` from the server environment. The key is never in the bundle (`npm run build` runs
  `scripts/check-bundle-secrets.mjs` to verify).
- Only read-only catalog endpoints are proxied (`trending`, `movie`, `tv`, `search`, `discover`, `genre`,
  `configuration`); responses are cached in memory (10 min, 24 h for genres) and identical requests are coalesced.
- Images load directly from the official CDN `https://image.tmdb.org/t/p/<size>/…`; `resizeImage` picks the smallest
  official size for the rendered width. A service worker caches artwork in production builds.
- `GET /api/tmdb/__status` reports whether the key is configured and TMDB is reachable (used by Settings › Network
  diagnostics).
- TMDB provides metadata and artwork only — no streaming rights, playable media or Sky channel availability.
  Attribution is shown in Settings › App information.
- Behind an outbound HTTP proxy, Node's `fetch` needs proxy support (Node ≥ 24: `NODE_USE_ENV_PROXY=1`).

## Sky Originals

The "original" badge is driven exclusively by `src/config/originals.ts` (ids, or exact title + year lookups resolved
through search). It is never inferred from TMDB. Replace the configuration with an authoritative editorial feed
(`POST /catalog/collections/resolve` accepts the same entries).

## Kids safety

Kids content uses audience-filtered queries (TMDB: `discover` with the Kids/Family genres and `certification=U|PG` for
films) plus a client-side guard (`src/screens/kids/kidsFilter.ts`) and a kids-safe check in the player. **This is not a
complete child-safety solution**: production systems need curated, server-enforced ratings per territory.

## Live TV

Channels, schedules and the stream are demo fixtures (`src/api/fixtures/live.ts`), labelled as such in the UI.
Real deployments must supply authorised channel lists, EPG data, entitlements and stream URLs from licensed sources
via `LiveTvService`, `EpgService` and `PlaybackService`. Nothing in this repository represents real Sky schedules.
