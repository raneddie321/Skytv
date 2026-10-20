/**
 * DATA_MODE=remote synchronisation between the on-device stores (instant UI) and the backend (source of truth).
 *  - On profile selection: hydrate watchlist + history from the API.
 *  - On local changes: push watchlist additions/removals and progress updates.
 * In mock mode this is a no-op because the stores themselves are the persistence layer.
 */
import type { Services } from './contracts/services';
import { useLibrary } from '@/state/library';
import { useProfiles } from '@/state/profiles';

export function startRemoteSync(services: Services): () => void {
  if (services.mode !== 'remote') return () => undefined;
  let hydrating = false;

  const hydrateProfiles = async () => {
    try {
      const profiles = await services.profiles.list();
      if (profiles.length) useProfiles.getState().replaceAll(profiles);
    } catch {
      /* keep cached profiles */
    }
  };

  const hydrate = async (profileId: string) => {
    hydrating = true;
    try {
      const [watchlist, history] = await Promise.all([services.watchlist.list(profileId), services.history.list(profileId)]);
      useLibrary.getState().replaceLibrary(profileId, {
        watchlist,
        progress: Object.fromEntries(history.map((r) => [r.key, r])),
      });
    } catch {
      /* offline: keep local copy */
    } finally {
      hydrating = false;
    }
  };

  void hydrateProfiles();
  const active = useProfiles.getState().activeProfileId;
  if (active) void hydrate(active);

  const unsubProfiles = useProfiles.subscribe((s, prev) => {
    if (s.activeProfileId && s.activeProfileId !== prev.activeProfileId) void hydrate(s.activeProfileId);
  });

  const unsubLibrary = useLibrary.subscribe((s, prev) => {
    if (hydrating) return;
    for (const [pid, lib] of Object.entries(s.byProfile)) {
      const before = prev.byProfile[pid];
      if (!before || lib === before) continue;
      if (lib.watchlist !== before.watchlist) {
        const was = new Set(before.watchlist.map((w) => w.id));
        const now = new Set(lib.watchlist.map((w) => w.id));
        lib.watchlist.filter((w) => !was.has(w.id)).forEach((w) => void services.watchlist.add(pid, w).catch(() => undefined));
        before.watchlist.filter((w) => !now.has(w.id)).forEach((w) => void services.watchlist.remove(pid, w.id).catch(() => undefined));
      }
      if (lib.progress !== before.progress) {
        for (const [key, rec] of Object.entries(lib.progress)) {
          if (before.progress[key] !== rec) void services.history.save(pid, rec).catch(() => undefined);
        }
        for (const key of Object.keys(before.progress)) {
          if (!lib.progress[key]) void services.history.remove(pid, key).catch(() => undefined);
        }
      }
    }
  });

  return () => {
    unsubProfiles();
    unsubLibrary();
  };
}
