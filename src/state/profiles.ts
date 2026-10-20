import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile, ProfileInput } from '@/api/contracts/services';
import { persistStorage, STORAGE_PREFIX } from './storage';

export const DEFAULT_PROFILES: Profile[] = [
  { id: 'p-emma', name: 'Emma', avatarId: 'dusk', kind: 'adult', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'p-noah', name: 'Noah', avatarId: 'ocean', kind: 'adult', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'p-daniel', name: 'Daniel', avatarId: 'slate', kind: 'adult', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'p-kids', name: 'Kids', avatarId: 'kids-bloop', kind: 'kids', createdAt: '2025-01-01T00:00:00.000Z' },
];

export const MAX_PROFILES = 6;

interface ProfilesState {
  profiles: Profile[];
  activeProfileId: string | null;
  create: (input: ProfileInput) => Profile;
  update: (id: string, patch: Partial<ProfileInput>) => void;
  remove: (id: string) => void;
  select: (id: string) => void;
  clearActive: () => void;
  replaceAll: (profiles: Profile[]) => void;
}

const newId = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useProfiles = create<ProfilesState>()(
  persist(
    (set, get) => ({
      profiles: DEFAULT_PROFILES,
      activeProfileId: null,
      create: (input) => {
        const profile: Profile = { ...input, name: input.name.trim().slice(0, 20), id: newId(), createdAt: new Date().toISOString() };
        set({ profiles: [...get().profiles, profile].slice(0, MAX_PROFILES) });
        return profile;
      },
      update: (id, patch) =>
        set({
          profiles: get().profiles.map((p) =>
            p.id === id ? { ...p, ...patch, name: (patch.name ?? p.name).trim().slice(0, 20) || p.name } : p,
          ),
        }),
      remove: (id) =>
        set({
          profiles: get().profiles.filter((p) => p.id !== id),
          activeProfileId: get().activeProfileId === id ? null : get().activeProfileId,
        }),
      select: (id) => set({ activeProfileId: get().profiles.some((p) => p.id === id) ? id : null }),
      clearActive: () => set({ activeProfileId: null }),
      replaceAll: (profiles) => set({ profiles }),
    }),
    { name: `${STORAGE_PREFIX}profiles`, storage: persistStorage, version: 1 },
  ),
);

export const useActiveProfile = () =>
  useProfiles((s) => s.profiles.find((p) => p.id === s.activeProfileId) ?? null);
