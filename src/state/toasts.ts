import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  icon?: 'check' | 'info' | 'wifi' | 'bookmark';
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, icon?: Toast['icon']) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (message, icon = 'check') => {
    const id = ++seq;
    set({ toasts: [...get().toasts.slice(-2), { id, message, icon }] });
    setTimeout(() => get().dismiss(id), 2600);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (message: string, icon?: Toast['icon']) => useToasts.getState().show(message, icon);
