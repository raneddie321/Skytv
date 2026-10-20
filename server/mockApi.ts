/**
 * Reference mock implementation of the REST contract in docs/api/openapi.yaml.
 * Backed by the offline demo catalog and in-memory state. Used to exercise DATA_MODE=remote locally;
 * it is NOT a production backend (no persistence, demo authentication only).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { FixtureCatalog, NotFoundError } from '../src/api/fixtures/catalog';
import { FixtureLiveTv } from '../src/api/fixtures/live';
import type { MediaRef, PlaybackContent, RailQuery } from '../src/api/contracts/domain';
import type { Profile, ProgressRecord } from '../src/api/contracts/services';
import { readJsonBody, sendJson, type Next } from './http';

interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  params: string[];
  query: URLSearchParams;
  body: () => Promise<unknown>;
}
type Route = [method: string, pattern: RegExp, handler: (ctx: Ctx) => Promise<unknown> | unknown];

const DEMO_TOKEN = 'demo-access-token';

export function createMockApi() {
  const catalog = new FixtureCatalog(0);
  const live = new FixtureLiveTv(0);
  const state = {
    profiles: [
      { id: 'p-emma', name: 'Emma', avatarId: 'dusk', kind: 'adult', createdAt: '2025-01-01T00:00:00.000Z' },
      { id: 'p-noah', name: 'Noah', avatarId: 'ocean', kind: 'adult', createdAt: '2025-01-01T00:00:00.000Z' },
      { id: 'p-daniel', name: 'Daniel', avatarId: 'slate', kind: 'adult', createdAt: '2025-01-01T00:00:00.000Z' },
      { id: 'p-kids', name: 'Kids', avatarId: 'kids-bloop', kind: 'kids', createdAt: '2025-01-01T00:00:00.000Z' },
    ] as Profile[],
    history: new Map<string, Map<string, ProgressRecord>>(),
    watchlist: new Map<string, MediaRef[]>(),
    parental: { pin: '1234', settings: { kidsMaxCertification: 'U', pinFor18: false } },
    devicePolls: new Map<string, number>(),
  };
  const historyOf = (pid: string) => state.history.get(pid) ?? state.history.set(pid, new Map()).get(pid)!;
  const session = () => ({ accountId: 'demo-account', accessToken: DEMO_TOKEN, expiresAt: '2099-01-01T00:00:00.000Z', isDemo: true });
  const httpError = (status: number, error: string, message: string) => Object.assign(new Error(message), { status, error });
  const profileExists = (pid: string) => {
    if (!state.profiles.some((p) => p.id === pid)) throw httpError(404, 'not_found', `Unknown profile ${pid}`);
  };

  const routes: Route[] = [
    ['GET', /^\/auth\/session$/, () => session()],
    ['DELETE', /^\/auth\/session$/, () => undefined],
    ['POST', /^\/auth\/device$/, () => {
      const deviceCode = `dev-${Math.random().toString(36).slice(2, 10)}`;
      state.devicePolls.set(deviceCode, 0);
      return { userCode: 'DEMO-2026', verificationUrl: 'https://example.com/activate', pollIntervalSec: 5, deviceCode };
    }],
    ['POST', /^\/auth\/device\/token$/, async ({ body, res }) => {
      const { deviceCode } = ((await body()) ?? {}) as { deviceCode?: string };
      const polls = (state.devicePolls.get(deviceCode ?? '') ?? -1) + 1;
      if (polls === 0) throw httpError(400, 'invalid_device_code', 'Unknown device code');
      state.devicePolls.set(deviceCode!, polls);
      if (polls < 2) {
        sendJson(res, 202, { status: 'authorization_pending' });
        return SENT;
      }
      return session();
    }],
    ['GET', /^\/account$/, () => ({ id: 'demo-account', email: 'viewer@example.com', displayName: 'Demo Household', country: 'GB', isDemo: true })],
    ['GET', /^\/subscription$/, () => ({
      plan: 'Demo Essential',
      packs: [
        { id: 'entertainment', name: 'Entertainment', active: true },
        { id: 'cinema', name: 'Cinema', active: true },
        { id: 'sports', name: 'Sports', active: false },
        { id: 'kids', name: 'Kids', active: true },
      ],
      renewsOn: '2026-12-01',
      isDemo: true,
    })],

    ['GET', /^\/profiles$/, () => ({ items: state.profiles })],
    ['POST', /^\/profiles$/, async ({ body, res }) => {
      const input = (await body()) as Partial<Profile>;
      if (!input?.name || !input.avatarId || !['adult', 'kids'].includes(input.kind ?? '')) throw httpError(422, 'validation_error', 'name, avatarId and kind are required');
      if (state.profiles.length >= 6) throw httpError(409, 'profile_limit', 'A household can have at most 6 profiles');
      const profile: Profile = { id: `p-${Date.now().toString(36)}`, name: input.name.slice(0, 20), avatarId: input.avatarId, kind: input.kind!, createdAt: new Date().toISOString() };
      state.profiles.push(profile);
      sendJson(res, 201, profile);
      return SENT;
    }],
    ['PATCH', /^\/profiles\/([^/]+)$/, async ({ params, body }) => {
      const p = state.profiles.find((x) => x.id === params[0]);
      if (!p) throw httpError(404, 'not_found', 'Unknown profile');
      Object.assign(p, pickDefined((await body()) as Partial<Profile>, ['name', 'avatarId', 'kind']));
      return p;
    }],
    ['DELETE', /^\/profiles\/([^/]+)$/, ({ params }) => {
      state.profiles = state.profiles.filter((p) => p.id !== params[0]);
      state.history.delete(params[0]);
      state.watchlist.delete(params[0]);
    }],

    ['GET', /^\/catalog\/rails$/, ({ query }) =>
      catalog.getRail({
        kind: (query.get('kind') ?? 'popular') as RailQuery['kind'],
        mediaType: (query.get('mediaType') ?? 'all') as RailQuery['mediaType'],
        genreId: query.get('genreId') ?? undefined,
        page: Number(query.get('page') ?? 1),
        audience: query.get('audience') === 'kids' ? 'kids' : 'all',
      })],
    ['GET', /^\/catalog\/featured$/, async ({ query }) => ({ items: await catalog.getFeatured((query.get('context') ?? 'home') as 'home') })],
    ['GET', /^\/catalog\/genres$/, async ({ query }) => ({
      items: await catalog.getGenres(query.get('mediaType') === 'tv' ? 'tv' : 'movie', query.get('audience') === 'kids' ? 'kids' : 'all'),
    })],
    ['GET', /^\/catalog\/movies\/([^/]+)$/, ({ params }) => catalog.getMovie(params[0])],
    ['GET', /^\/catalog\/series\/([^/]+)$/, ({ params }) => catalog.getSeries(params[0])],
    ['GET', /^\/catalog\/series\/([^/]+)\/seasons\/(\d+)$/, ({ params }) => catalog.getSeason(params[0], Number(params[1]))],
    ['POST', /^\/catalog\/collections\/resolve$/, async ({ body }) => ({
      items: await catalog.resolveCollection((((await body()) as { entries?: [] })?.entries ?? []) as never),
    })],
    ['GET', /^\/catalog\/titles\/([^/]+)\/similar$/, async ({ params }) => ({ items: await catalog.similarTo(params[0]) })],
    ['GET', /^\/search$/, ({ query }) =>
      catalog.search(query.get('q') ?? '', { audience: query.get('audience') === 'kids' ? 'kids' : 'all', page: Number(query.get('page') ?? 1) })],
    ['POST', /^\/recommendations$/, async ({ body }) => {
      const b = ((await body()) ?? {}) as { seeds?: string[]; audience?: 'all' | 'kids' };
      return { items: await catalog.forProfile((b.seeds ?? []).map((id) => ({ id })), b.audience ?? 'all') };
    }],

    ['GET', /^\/profiles\/([^/]+)\/history$/, ({ params }) => {
      profileExists(params[0]);
      return { items: [...historyOf(params[0]).values()] };
    }],
    ['PUT', /^\/profiles\/([^/]+)\/history\/([^/]+)$/, async ({ params, body }) => {
      profileExists(params[0]);
      const record = (await body()) as ProgressRecord;
      if (!record || record.key !== params[1]) throw httpError(422, 'validation_error', 'Body key must match the path');
      historyOf(params[0]).set(record.key, record);
      return record;
    }],
    ['DELETE', /^\/profiles\/([^/]+)\/history\/([^/]+)$/, ({ params }) => {
      historyOf(params[0]).delete(params[1]);
    }],
    ['GET', /^\/profiles\/([^/]+)\/watchlist$/, ({ params }) => {
      profileExists(params[0]);
      return { items: state.watchlist.get(params[0]) ?? [] };
    }],
    ['PUT', /^\/profiles\/([^/]+)\/watchlist\/([^/]+)$/, async ({ params, body }) => {
      profileExists(params[0]);
      const item = (await body()) as MediaRef;
      if (!item || item.id !== params[1]) throw httpError(422, 'validation_error', 'Body id must match the path');
      const list = (state.watchlist.get(params[0]) ?? []).filter((w) => w.id !== item.id);
      state.watchlist.set(params[0], [item, ...list]);
      return item;
    }],
    ['DELETE', /^\/profiles\/([^/]+)\/watchlist\/([^/]+)$/, ({ params }) => {
      state.watchlist.set(params[0], (state.watchlist.get(params[0]) ?? []).filter((w) => w.id !== params[1]));
    }],

    ['GET', /^\/live\/channels$/, async () => ({ items: await live.getChannels() })],
    ['GET', /^\/live\/schedule$/, async ({ query }) => {
      const from = new Date(query.get('from') ?? Date.now());
      const to = new Date(query.get('to') ?? Date.now() + 6 * 3600_000);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw httpError(422, 'validation_error', 'Invalid time range');
      if (to.getTime() - from.getTime() > 7 * 24 * 3600_000) throw httpError(422, 'validation_error', 'Range limited to 7 days');
      return { schedule: await live.getSchedule((query.get('channelIds') ?? '').split(',').filter(Boolean), from, to) };
    }],

    ['POST', /^\/playback\/sessions$/, async ({ body, res }) => {
      const b = ((await body()) ?? {}) as { profileId?: string; content?: PlaybackContent };
      if (!b.profileId || !b.content) throw httpError(422, 'validation_error', 'profileId and content are required');
      sendJson(res, 201, {
        sessionId: `ps-${Date.now().toString(36)}`,
        content: b.content,
        sources: [
          { url: '/media/sample/hls/index.m3u8', protocol: 'hls', mimeType: 'application/vnd.apple.mpegurl', codecs: 'avc1.4d401f,mp4a.40.2' },
          { url: '/media/sample/sample.webm', protocol: 'progressive', mimeType: 'video/webm', codecs: 'vp9,opus' },
        ],
        subtitles: [
          { id: 'en', language: 'en', label: 'English', url: '/media/sample/sample.en.vtt', kind: 'subtitles' },
          { id: 'fr', language: 'fr', label: 'Français', url: '/media/sample/sample.fr.vtt', kind: 'subtitles' },
        ],
        isSample: true,
        isLive: b.content.kind === 'channel',
        heartbeatIntervalSec: 30,
        expiresAt: new Date(Date.now() + 4 * 3600_000).toISOString(),
      });
      return SENT;
    }],
    ['POST', /^\/playback\/sessions\/([^/]+)\/heartbeat$/, () => undefined],
    ['DELETE', /^\/playback\/sessions\/([^/]+)$/, () => undefined],
    ['POST', /^\/entitlements\/check$/, async ({ body }) => {
      const b = ((await body()) ?? {}) as { content?: PlaybackContent };
      const c = b.content;
      const contentId = !c ? '' : c.kind === 'channel' ? c.channelId : c.kind === 'movie' ? c.id : c.seriesId;
      return { contentId, entitled: true };
    }],

    ['POST', /^\/parental\/pin\/verify$/, async ({ body }) => ({ valid: (((await body()) ?? {}) as { pin?: string }).pin === state.parental.pin })],
    ['PUT', /^\/parental\/pin$/, async ({ body }) => {
      const b = ((await body()) ?? {}) as { currentPin?: string; newPin?: string };
      const ok = b.currentPin === state.parental.pin && /^\d{4}$/.test(b.newPin ?? '');
      if (ok) state.parental.pin = b.newPin!;
      return { ok };
    }],
    ['GET', /^\/parental\/settings$/, () => state.parental.settings],
    ['PUT', /^\/parental\/settings$/, async ({ body }) => {
      Object.assign(state.parental.settings, pickDefined((await body()) as object, ['kidsMaxCertification', 'pinFor18']));
      return state.parental.settings;
    }],
  ];

  return (req: IncomingMessage, res: ServerResponse, next?: Next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = req.method ?? 'GET';
    if (!path.startsWith('/auth') && req.headers.authorization && req.headers.authorization !== `Bearer ${DEMO_TOKEN}`) {
      return sendJson(res, 401, { error: 'unauthorized', message: 'Invalid access token' });
    }
    for (const [m, pattern, handler] of routes) {
      if (m !== method) continue;
      const match = pattern.exec(path);
      if (!match) continue;
      let parsed: Promise<unknown> | null = null;
      const ctx: Ctx = {
        req,
        res,
        params: match.slice(1).map(decodeURIComponent),
        query: url.searchParams,
        body: () => (parsed ??= readJsonBody(req)),
      };
      Promise.resolve()
        .then(() => handler(ctx))
        .then((result) => {
          if (result === SENT || res.headersSent) return;
          if (result === undefined) {
            res.writeHead(204);
            res.end();
          } else sendJson(res, 200, result);
        })
        .catch((e: { status?: number; error?: string; message?: string }) => {
          const status = e instanceof NotFoundError ? 404 : e.status ?? 500;
          sendJson(res, status, { error: e.error ?? (status === 404 ? 'not_found' : 'internal_error'), message: e.message ?? 'Error' });
        });
      return;
    }
    if (next) return next();
    sendJson(res, 404, { error: 'not_found', message: `No route for ${method} ${path}` });
  };
}

const SENT = Symbol('sent');

function pickDefined<T extends object>(obj: T | undefined, keys: string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (obj && (obj as Record<string, unknown>)[k] !== undefined) out[k] = (obj as Record<string, unknown>)[k];
  return out as Partial<T>;
}
