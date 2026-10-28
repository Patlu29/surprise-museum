import { useAnnouncerStore } from '@/state/announcer';

/** The single polite live region for scene and builder announcements (design spec 8.3). Mount once. */
export function Announcer() {
  const message = useAnnouncerStore((state) => state.message);
  const seq = useAnnouncerStore((state) => state.seq);
  // A trailing no-break space on alternate messages makes a repeated sentence announce again.
  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message ? `${message}${seq % 2 === 0 ? ' ' : ''}` : ''}
    </div>
  );
}
