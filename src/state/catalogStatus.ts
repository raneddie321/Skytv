import { create } from 'zustand';

interface CatalogStatusState {
  /** True when TMDB was unreachable and the offline demo catalog is being shown instead. */
  usingFallback: boolean;
  lastError?: string;
  online: boolean;
  setFallback: (usingFallback: boolean, lastError?: string) => void;
  setOnline: (online: boolean) => void;
}

export const useCatalogStatus = create<CatalogStatusState>()((set) => ({
  usingFallback: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  setFallback: (usingFallback, lastError) => set({ usingFallback, lastError }),
  setOnline: (online) => set({ online }),
}));
