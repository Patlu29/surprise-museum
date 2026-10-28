import { useEffect } from 'react';
import type { MuseumContent } from '@contract';
import {
  areaAnnouncement,
  failedPhotoAnnouncement,
  finaleAnnouncement,
  hintAnnouncement,
  presentationAnnouncement,
  REPLAY_ANNOUNCEMENT,
} from '@/lib/announcements';
import { announce } from '@/state/announcer';
import { useSessionStore } from '@/state/sessionStore';

const AREA_THROTTLE_MS = 4000;

/**
 * Turns scene events into polite live-region announcements (design spec 8.3, FR-63): the
 * caption when a presentation starts, the finale, room changes (at most one every 4 s), a
 * failed photo, the hint, and Replay.
 */
export function useSessionAnnouncements(content: MuseumContent): void {
  useEffect(() => {
    const total = content.photos.length;
    const indexOf = (photoId: string) => content.photos.findIndex((photo) => photo.id === photoId);
    let lastAreaAt = 0;
    let areaTimer: number | null = null;
    let lastFinaleAt = -Infinity;
    // The finale can arrive as `finaleReached`, as a 'finale' presentation, or both: say it once.
    const sayFinale = () => {
      const now = performance.now();
      if (now - lastFinaleAt < 1000) return;
      lastFinaleAt = now;
      announce(finaleAnnouncement(content.guideName));
    };

    const unsubscribers = [
      useSessionStore.subscribe(
        (state) => state.presentation,
        (presentation) => {
          if (presentation.kind === 'photo') {
            const index = indexOf(presentation.photoId);
            const photo = content.photos[index];
            if (photo) {
              announce(presentationAnnouncement(content.guideName, index, total, photo.caption));
            }
          } else if (presentation.kind === 'finale') {
            sayFinale();
          }
        },
      ),
      useSessionStore.subscribe(
        (state) => state.finaleReached,
        (reached) => {
          if (reached) sayFinale();
        },
      ),
      useSessionStore.subscribe(
        (state) => state.area,
        (area) => {
          if (!area) return;
          const say = () => {
            lastAreaAt = performance.now();
            const latest = useSessionStore.getState().area;
            if (latest) announce(areaAnnouncement(latest.kind, latest.index, latest.count));
          };
          if (areaTimer !== null) window.clearTimeout(areaTimer);
          const wait = AREA_THROTTLE_MS - (performance.now() - lastAreaAt);
          if (wait <= 0) say();
          else areaTimer = window.setTimeout(say, wait);
        },
      ),
      useSessionStore.subscribe(
        (state) => state.nearFailedPhotoId,
        (photoId) => {
          if (photoId) announce(failedPhotoAnnouncement(indexOf(photoId)));
        },
      ),
      useSessionStore.subscribe(
        (state) => state.hint,
        (hint) => {
          if (!hint) return;
          const index = hint.target.kind === 'photo' ? indexOf(hint.target.photoId) : -1;
          announce(hintAnnouncement(hint, index, total, content.guideName));
        },
      ),
      useSessionStore.subscribe(
        (state) => state.replaySeq,
        (seq) => {
          if (seq > 0) announce(REPLAY_ANNOUNCEMENT);
        },
      ),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
      if (areaTimer !== null) window.clearTimeout(areaTimer);
    };
  }, [content]);
}
