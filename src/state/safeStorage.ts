import type { StateStorage } from 'zustand/middleware';

/**
 * localStorage that never throws. Safari private browsing, blocked storage and Node (tests) all
 * fall back to a silent no-op, so a store never breaks the app because it cannot persist.
 */
export const safeLocalStorage: StateStorage = {
  getItem(name) {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(name, value);
    } catch {
      // Storage full or blocked. The setting still applies for this visit.
    }
  },
  removeItem(name) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(name);
    } catch {
      // Ignore.
    }
  },
};
