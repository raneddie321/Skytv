/**
 * REST implementations used when DATA_MODE=remote. Endpoints are specified in docs/api/openapi.yaml.
 * The reference mock server (server/mockApi.ts) implements the same contract for local testing.
 */
import type { Audience, Channel, Genre, MediaRef, MediaSummary, MovieDetail, Page, PlaybackSession, Programme, SeasonDetail, SeriesDetail } from '../contracts/domain';
import type { AuthSession, Services } from '../contracts/services';
import { requestJson, withQuery, type RequestOptions } from '../http';

const TOKEN_KEY = 'skytv.auth.token';

export class RemoteClient {
  constructor(private readonly baseUrl: string) {}

  get token(): string | null {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }
  set token(value: string | null) {
    try {
      if (value) window.localStorage.setItem(TOKEN_KEY, value);
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }

  request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { ...options.headers };
    const token = this.token;
    if (token) headers.Authorization = `Bearer ${token}`;
    return requestJson<T>(`${this.baseUrl}${path}`, { ...options, headers });
  }
}

const enc = encodeURIComponent;
type Items<T> = { items: T[] };

export function createRemoteServices(baseUrl: string): Omit<Services, 'mode'> {
  const api = new RemoteClient(baseUrl);
  const remember = (s: AuthSession | null) => {
    if (s) api.token = s.accessToken;
    return s;
  };

  const catalog = {
    source: 'remote' as const,
    getRail: (q: { kind: string; mediaType: string; genreId?: string; page?: number; audience?: Audience }) =>
      api.request<Page<MediaSummary>>(withQuery('/catalog/rails', { ...q })),
    getFeatured: (context: string) => api.request<Items<MediaSummary>>(withQuery('/catalog/featured', { context })).then((r) => r.items),
    getGenres: (mediaType: string, audience?: Audience) =>
      api.request<Items<Genre>>(withQuery('/catalog/genres', { mediaType, audience })).then((r) => r.items),
    getMovie: (id: string) => api.request<MovieDetail>(`/catalog/movies/${enc(id)}`),
    getSeries: (id: string) => api.request<SeriesDetail>(`/catalog/series/${enc(id)}`),
    getSeason: (id: string, n: number) => api.request<SeasonDetail>(`/catalog/series/${enc(id)}/seasons/${n}`),
    resolveCollection: (entries: unknown[]) =>
      api.request<Items<MediaSummary>>('/catalog/collections/resolve', { method: 'POST', body: { entries } }).then((r) => r.items),
  };

  return {
    auth: {
      getSession: () => api.request<AuthSession>('/auth/session').then(remember).catch(() => null),
      startDeviceSignIn: () => api.request('/auth/device', { method: 'POST' }),
      pollDeviceSignIn: (deviceCode) =>
        api.request<AuthSession | undefined>('/auth/device/token', { method: 'POST', body: { deviceCode } }).then((s) => remember(s ?? null)),
      signOut: async () => {
        await api.request('/auth/session', { method: 'DELETE' });
        api.token = null;
      },
    },
    account: { getAccount: () => api.request('/account') },
    subscription: { getSubscription: () => api.request('/subscription') },
    profiles: {
      list: () => api.request<Items<never>>('/profiles').then((r) => r.items),
      create: (input) => api.request('/profiles', { method: 'POST', body: input }),
      update: (id, input) => api.request(`/profiles/${enc(id)}`, { method: 'PATCH', body: input }),
      remove: (id) => api.request(`/profiles/${enc(id)}`, { method: 'DELETE' }),
    },
    catalog: catalog as Services['catalog'],
    search: {
      search: (q, o = {}) => api.request<Page<MediaSummary>>(withQuery('/search', { q, audience: o.audience, page: o.page })),
    },
    recommendations: {
      forProfile: (seeds, audience) =>
        api.request<Items<MediaSummary>>('/recommendations', { method: 'POST', body: { seeds: seeds.map((s) => s.id), audience } }).then((r) => r.items),
      similarTo: (id) => api.request<Items<MediaSummary>>(`/catalog/titles/${enc(id)}/similar`).then((r) => r.items),
    },
    history: {
      list: (pid) => api.request<Items<never>>(`/profiles/${enc(pid)}/history`).then((r) => r.items),
      save: (pid, record) => api.request(`/profiles/${enc(pid)}/history/${enc(record.key)}`, { method: 'PUT', body: record }),
      remove: (pid, key) => api.request(`/profiles/${enc(pid)}/history/${enc(key)}`, { method: 'DELETE' }),
    },
    watchlist: {
      list: (pid) => api.request<Items<MediaRef>>(`/profiles/${enc(pid)}/watchlist`).then((r) => r.items),
      add: (pid, item) => api.request(`/profiles/${enc(pid)}/watchlist/${enc(item.id)}`, { method: 'PUT', body: item }),
      remove: (pid, id) => api.request(`/profiles/${enc(pid)}/watchlist/${enc(id)}`, { method: 'DELETE' }),
    },
    live: { getChannels: () => api.request<Items<Channel>>('/live/channels').then((r) => r.items) },
    epg: {
      getSchedule: (channelIds, from, to) =>
        api
          .request<{ schedule: Record<string, Programme[]> }>(
            withQuery('/live/schedule', { channelIds: channelIds.join(','), from: from.toISOString(), to: to.toISOString() }),
          )
          .then((r) => r.schedule),
    },
    playback: {
      createSession: (profileId, content) => api.request<PlaybackSession>('/playback/sessions', { method: 'POST', body: { profileId, content } }),
      heartbeat: (id, positionSec) => api.request(`/playback/sessions/${enc(id)}/heartbeat`, { method: 'POST', body: { positionSec } }),
      endSession: (id) => api.request(`/playback/sessions/${enc(id)}`, { method: 'DELETE' }),
    },
    entitlements: { check: (profileId, content) => api.request('/entitlements/check', { method: 'POST', body: { profileId, content } }) },
    parental: {
      verifyPin: (pin) => api.request<{ valid: boolean }>('/parental/pin/verify', { method: 'POST', body: { pin } }).then((r) => r.valid),
      changePin: (currentPin, newPin) =>
        api.request<{ ok: boolean }>('/parental/pin', { method: 'PUT', body: { currentPin, newPin } }).then((r) => r.ok),
      getSettings: () => api.request('/parental/settings'),
      updateSettings: (s) => api.request('/parental/settings', { method: 'PUT', body: s }),
    },
  };
}
