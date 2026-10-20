import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage, STORAGE_PREFIX } from './storage';

export interface SettingsState {
  subtitles: { enabled: boolean; language: 'en' | 'fr'; size: 'small' | 'medium' | 'large'; background: boolean };
  audioLanguage: 'en' | 'original';
  playback: {
    autoplayNext: boolean;
    autoplayPreviews: boolean;
    /** auto = best supported (HLS when available, otherwise progressive). */
    preferredStream: 'auto' | 'hls' | 'progressive';
    dataSaver: boolean;
  };
  accessibility: { reduceMotion: 'system' | 'on' | 'off'; highContrast: boolean; largeText: boolean };
  parental: { pin: string; kidsMaxCertification: 'U' | 'PG'; pinFor18: boolean };
  update: <K extends keyof Omit<SettingsState, 'update' | 'reset'>>(key: K, patch: Partial<SettingsState[K]>) => void;
  setAudioLanguage: (lang: SettingsState['audioLanguage']) => void;
  reset: () => void;
}

/** Demo parental PIN. Production must verify the PIN server-side (ParentalControlsService). */
export const DEFAULT_PIN = '1234';

const defaults = {
  subtitles: { enabled: false, language: 'en' as const, size: 'medium' as const, background: true },
  audioLanguage: 'en' as const,
  playback: { autoplayNext: true, autoplayPreviews: true, preferredStream: 'auto' as const, dataSaver: false },
  accessibility: { reduceMotion: 'system' as const, highContrast: false, largeText: false },
  parental: { pin: DEFAULT_PIN, kidsMaxCertification: 'U' as const, pinFor18: false },
};

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaults,
      update: (key, patch) => set({ [key]: { ...(get()[key] as object), ...patch } } as Partial<SettingsState>),
      setAudioLanguage: (audioLanguage) => set({ audioLanguage }),
      reset: () => set({ ...defaults }),
    }),
    { name: `${STORAGE_PREFIX}settings`, storage: persistStorage, version: 1 },
  ),
);

export function prefersReducedMotion(setting: SettingsState['accessibility']['reduceMotion']): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
