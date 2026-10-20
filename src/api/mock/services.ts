/**
 * Mock implementations used when DATA_MODE=mock. They work entirely on-device:
 * personal data lives in the persisted zustand stores, live TV comes from local fixtures,
 * and playback always returns the labelled sample video.
 */
import type { PlaybackContent, PlaybackSession, StreamSource, SubtitleTrack } from '../contracts/domain';
import type {
  AccountService,
  AuthService,
  AuthSession,
  EntitlementService,
  ParentalControlsService,
  PlaybackService,
  ProfileService,
  SubscriptionService,
  WatchHistoryService,
  WatchlistService,
} from '../contracts/services';
import { useProfiles } from '@/state/profiles';
import { useLibrary } from '@/state/library';
import { useSettings } from '@/state/settings';

const DEMO_SESSION: AuthSession = {
  accountId: 'demo-account',
  accessToken: 'demo-token',
  expiresAt: '2099-01-01T00:00:00.000Z',
  isDemo: true,
};

export function createMockAuth(): AuthService {
  let polls = 0;
  return {
    getSession: async () => DEMO_SESSION,
    startDeviceSignIn: async () => ({ userCode: 'DEMO-2026', verificationUrl: 'https://example.com/activate', pollIntervalSec: 5, deviceCode: 'demo-device' }),
    pollDeviceSignIn: async () => (++polls >= 2 ? DEMO_SESSION : null),
    signOut: async () => undefined,
  };
}

export const mockAccount: AccountService = {
  getAccount: async () => ({ id: 'demo-account', email: 'viewer@example.com', displayName: 'Demo Household', country: 'GB', isDemo: true }),
};

export const mockSubscription: SubscriptionService = {
  getSubscription: async () => ({
    plan: 'Demo Essential',
    packs: [
      { id: 'entertainment', name: 'Entertainment', active: true },
      { id: 'cinema', name: 'Cinema', active: true },
      { id: 'sports', name: 'Sports', active: false },
      { id: 'kids', name: 'Kids', active: true },
    ],
    renewsOn: '2026-12-01',
    isDemo: true,
  }),
};

export const mockProfiles: ProfileService = {
  list: async () => useProfiles.getState().profiles,
  create: async (input) => useProfiles.getState().create(input),
  update: async (id, input) => {
    useProfiles.getState().update(id, input);
    return useProfiles.getState().profiles.find((p) => p.id === id)!;
  },
  remove: async (id) => useProfiles.getState().remove(id),
};

export const mockHistory: WatchHistoryService = {
  list: async (profileId) => Object.values(useLibrary.getState().byProfile[profileId]?.progress ?? {}),
  save: async (profileId, record) => useLibrary.getState().saveProgress(profileId, record),
  remove: async (profileId, key) => useLibrary.getState().removeProgress(profileId, key),
};

export const mockWatchlist: WatchlistService = {
  list: async (profileId) => useLibrary.getState().byProfile[profileId]?.watchlist ?? [],
  add: async (profileId, item) => {
    const list = useLibrary.getState().byProfile[profileId]?.watchlist ?? [];
    if (!list.some((w) => w.id === item.id)) useLibrary.getState().toggleWatchlist(profileId, item);
  },
  remove: async (profileId, id) => useLibrary.getState().removeFromWatchlist(profileId, id),
};

export const SAMPLE_SOURCES: StreamSource[] = [
  { url: '/media/sample/hls/index.m3u8', protocol: 'hls', mimeType: 'application/vnd.apple.mpegurl', codecs: 'avc1.4d401f,mp4a.40.2' },
  { url: '/media/sample/sample.webm', protocol: 'progressive', mimeType: 'video/webm', codecs: 'vp9,opus' },
];

export const SAMPLE_SUBTITLES: SubtitleTrack[] = [
  { id: 'en', language: 'en', label: 'English', url: '/media/sample/sample.en.vtt', kind: 'subtitles' },
  { id: 'fr', language: 'fr', label: 'Français', url: '/media/sample/sample.fr.vtt', kind: 'subtitles' },
];

export const mockPlayback: PlaybackService = {
  createSession: async (_profileId, content: PlaybackContent): Promise<PlaybackSession> => ({
    sessionId: `demo-${Date.now().toString(36)}`,
    content,
    sources: SAMPLE_SOURCES,
    subtitles: SAMPLE_SUBTITLES,
    isSample: true,
    isLive: content.kind === 'channel',
    heartbeatIntervalSec: 30,
    expiresAt: new Date(Date.now() + 4 * 3600_000).toISOString(),
  }),
  heartbeat: async () => undefined,
  endSession: async () => undefined,
};

export const mockEntitlements: EntitlementService = {
  check: async (_profileId, content) => ({
    contentId: content.kind === 'channel' ? content.channelId : content.kind === 'movie' ? content.id : content.seriesId,
    entitled: true,
  }),
};

export const mockParental: ParentalControlsService = {
  verifyPin: async (pin) => pin === useSettings.getState().parental.pin,
  changePin: async (current, next) => {
    if (current !== useSettings.getState().parental.pin || !/^\d{4}$/.test(next)) return false;
    useSettings.getState().update('parental', { pin: next });
    return true;
  },
  getSettings: async () => {
    const p = useSettings.getState().parental;
    return { kidsMaxCertification: p.kidsMaxCertification, pinFor18: p.pinFor18 };
  },
  updateSettings: async (s) => {
    useSettings.getState().update('parental', s);
    return s;
  },
};
