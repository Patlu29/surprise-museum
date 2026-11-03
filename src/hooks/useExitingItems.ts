import { useEffect, useState } from 'react';
import { cssDurationMs } from '@/lib/css';

export interface ExitingItem<T> {
  item: T;
  leaving: boolean;
}

interface Removed<T> {
  item: T;
  index: number;
}

/**
 * Keeps an item that has left the list mounted for `--duration-fast` so it can fade out. The token
 * is 0 ms under reduced motion, so removal is then instant (design spec 12.4.3). Items are matched
 * by `keyOf`.
 */
export function useExitingItems<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Array<ExitingItem<T>> {
  const signature = items.map(keyOf).join('|');
  const [seen, setSeen] = useState({ signature, items });
  const [leaving, setLeaving] = useState<Array<Removed<T>>>([]);

  if (seen.signature !== signature) {
    // Adjusting state while rendering is the supported way to react to a changed input.
    const present = new Set(items.map(keyOf));
    const removed = seen.items
      .map((item, index) => ({ item, index }))
      .filter((entry) => !present.has(keyOf(entry.item)));
    setSeen({ signature, items });
    if (removed.length > 0 && cssDurationMs('--duration-fast', 150) > 0) {
      setLeaving((current) => [...current, ...removed]);
    }
  }

  useEffect(() => {
    if (leaving.length === 0) return;
    const timer = window.setTimeout(() => setLeaving([]), cssDurationMs('--duration-fast', 150));
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const merged: Array<ExitingItem<T>> = items.map((item) => ({ item, leaving: false }));
  const have = new Set(items.map(keyOf));
  for (const entry of leaving) {
    if (have.has(keyOf(entry.item))) continue;
    merged.splice(Math.min(entry.index, merged.length), 0, { item: entry.item, leaving: true });
  }
  return merged;
}
