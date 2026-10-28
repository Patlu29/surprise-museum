import { useRef } from 'react';
import type { MuseumContent } from '@contract';
import { firstLine } from '@/lib/text';
import type { JumpTarget } from '@/state/sessionStore';
import { useSessionStore } from '@/state/sessionStore';
import { Icon } from '@/ui/components/Icon';
import { Sheet } from '@/ui/components/Sheet';

interface PicturesSheetProps {
  open: boolean;
  onClose: () => void;
  content: MuseumContent;
  onJump: (target: JumpTarget, label: string) => void;
}

/**
 * The Pictures list with jump-to-photo (design spec 5.12, FR-36, US-44), promoted to MVP Must as
 * the accessible route to any picture. Viewed pictures say "Viewed" in words, not colour alone.
 */
export function PicturesSheet({ open, onClose, content, onJump }: PicturesSheetProps) {
  const viewed = useSessionStore((state) => state.viewed);
  const firstRef = useRef<HTMLButtonElement>(null);
  const total = content.photos.length;

  return (
    <Sheet open={open} onClose={onClose} title="Pictures" initialFocusRef={firstRef}>
      <p className="muted">Choose a picture and you will be taken to stand in front of it.</p>
      <ul className="picture-list">
        {content.photos.map((photo, index) => {
          const isViewed = viewed.has(photo.id);
          const summary = firstLine(photo.caption);
          return (
            <li key={photo.id}>
              <button
                ref={index === 0 ? firstRef : undefined}
                type="button"
                className="picture-row"
                onClick={() =>
                  onJump(
                    { kind: 'photo', photoId: photo.id },
                    `Moved to photo ${index + 1} of ${total}`,
                  )
                }
              >
                <span
                  className="picture-row__thumb"
                  style={photo.lqip ? { backgroundImage: `url(${photo.lqip})` } : undefined}
                >
                  <img src={photo.wallUrl} alt="" loading="lazy" decoding="async" />
                </span>
                <span className="picture-row__text">
                  <span className="picture-row__title">Photo {index + 1}</span>
                  {summary ? (
                    <span className="picture-row__caption user-text">{summary}</span>
                  ) : null}
                </span>
                {isViewed ? (
                  <span className="picture-row__viewed">
                    <Icon name="check" size="sm" /> Viewed
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className="picture-row"
            onClick={() => onJump({ kind: 'finale' }, 'Moved to the finale')}
          >
            <span className="picture-row__thumb picture-row__thumb--finale" aria-hidden="true">
              <Icon name="heart" />
            </span>
            <span className="picture-row__text">
              <span className="picture-row__title user-text">
                Finale: a note from {content.guideName}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </Sheet>
  );
}
