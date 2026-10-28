import { create } from 'zustand';

/**
 * Text for the visually hidden polite live region (`<Announcer />`, design spec 8.3).
 * Anything may call `announce()`: the UI, or the scene for events only it knows about.
 */
interface AnnouncerState {
  message: string;
  /** Changes on every call, so repeating the same sentence is announced again. */
  seq: number;
  announce: (message: string) => void;
  clear: () => void;
}

export const useAnnouncerStore = create<AnnouncerState>()((set) => ({
  message: '',
  seq: 0,
  announce: (message) => set((state) => ({ message, seq: state.seq + 1 })),
  clear: () => set({ message: '' }),
}));

export function announce(message: string): void {
  useAnnouncerStore.getState().announce(message);
}
