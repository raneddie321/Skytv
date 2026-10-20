import { create } from 'zustand';

/** In-memory parental unlock (never persisted): lets a Kids profile open Settings after entering the PIN. */
interface ParentalSessionState {
  unlocked: boolean;
  unlock: () => void;
  lock: () => void;
}

export const useParentalSession = create<ParentalSessionState>()((set) => ({
  unlocked: false,
  unlock: () => set({ unlocked: true }),
  lock: () => set({ unlocked: false }),
}));
