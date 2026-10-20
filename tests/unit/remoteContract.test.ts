// @vitest-environment node
/**
 * Exercises the DATA_MODE=remote adapters against the reference mock server, proving that the REST contract
 * (docs/api/openapi.yaml), the client and the reference implementation agree.
 */
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRemoteServices } from '@/api/remote/services';
import { createMockApi } from '../../server/mockApi';

let server: Server;
let api: ReturnType<typeof createRemoteServices>;

beforeAll(async () => {
  const handler = createMockApi();
  server = createServer((req, res) => {
    req.url = req.url!.replace(/^\/api\/v1/, '');
    handler(req, res);
  });
  await new Promise<void>((r) => server.listen(0, r));
  api = createRemoteServices(`http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`);
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('remote REST contract (reference mock server)', () => {
  it('authenticates with the device flow', async () => {
    const start = await api.auth.startDeviceSignIn();
    expect(start.userCode).toBeTruthy();
    expect(await api.auth.pollDeviceSignIn(start.deviceCode)).toBeNull(); // 202 pending
    const session = await api.auth.pollDeviceSignIn(start.deviceCode);
    expect(session?.accessToken).toBeTruthy();
  });

  it('serves catalog rails, details, seasons and search', async () => {
    const rail = await api.catalog.getRail({ kind: 'popular', mediaType: 'tv' });
    expect(rail.items.length).toBeGreaterThan(5);
    const series = await api.catalog.getSeries('demo:tv:kingsgate');
    expect(series.seasons).toHaveLength(3);
    const season = await api.catalog.getSeason('demo:tv:kingsgate', 2);
    expect(season.episodes).toHaveLength(8);
    const found = await api.search.search('solar');
    expect(found.items[0].title).toBe('Solar Drift');
    await expect(api.catalog.getMovie('demo:movie:nope')).rejects.toMatchObject({ status: 404 });
  });

  it('manages profiles, watchlist and history', async () => {
    const created = await api.profiles.create({ name: 'Guest', avatarId: 'gold', kind: 'adult' });
    expect((await api.profiles.list()).some((p) => p.id === created.id)).toBe(true);
    await api.watchlist.add(created.id, { id: 'demo:movie:summit', type: 'movie', title: 'Summit' });
    expect((await api.watchlist.list(created.id)).map((w) => w.id)).toEqual(['demo:movie:summit']);
    await api.history.save(created.id, {
      key: 'movie:demo:movie:summit',
      media: { id: 'demo:movie:summit', type: 'movie', title: 'Summit' },
      positionSec: 120,
      durationSec: 7000,
      completed: false,
      updatedAt: new Date().toISOString(),
    });
    expect(await api.history.list(created.id)).toHaveLength(1);
    await api.profiles.remove(created.id);
    await expect(api.watchlist.list(created.id)).rejects.toMatchObject({ status: 404 });
  });

  it('returns live channels, schedules and playback sessions', async () => {
    const channels = await api.live.getChannels();
    const now = new Date();
    const schedule = await api.epg.getSchedule([channels[0].id], now, new Date(now.getTime() + 3600_000));
    expect(schedule[channels[0].id].length).toBeGreaterThan(0);
    const session = await api.playback.createSession('p-emma', { kind: 'channel', channelId: channels[0].id });
    expect(session).toMatchObject({ isLive: true, isSample: true });
    expect((await api.entitlements.check('p-emma', { kind: 'movie', id: 'demo:movie:summit' })).entitled).toBe(true);
  });

  it('verifies the parental PIN server-side', async () => {
    expect(await api.parental.verifyPin('0000')).toBe(false);
    expect(await api.parental.verifyPin('1234')).toBe(true);
  });
});
