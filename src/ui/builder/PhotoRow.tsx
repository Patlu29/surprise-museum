import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { LIMITS } from '@contract';
import { announce } from '@/state/announcer';
import { useBuilderStore } from '@/state/builderStore';
import type { DraftPhoto } from '@/state/draft';
import { removePhoto, replacePhoto, retryPhoto } from '@/state/uploadQueue';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { LimitedField } from '@/ui/components/LimitedField';
import { ProgressBar } from '@/ui/components/ProgressBar';

interface PhotoRowProps {
  photo: DraftPhoto;
  index: number;
  total: number;
  /** The list element, so a drag can find the row under the pointer. */
  listRef: React.RefObject<HTMLOListElement | null>;
}

/** Errors a retry cannot fix: the Creator needs to replace or remove the photo instead. */
const RETRYABLE: ReadonlyArray<DraftPhoto['errorKind']> = ['network', 'other'];

function statusText(photo: DraftPhoto): string {
  switch (photo.status) {
    case 'queued':
      return 'Waiting...';
    case 'processing':
      return 'Preparing photo...';
    case 'uploading':
      return photo.progress > 0 ? `Uploading ${Math.round(photo.progress * 100)}%` : 'Uploading...';
    case 'ready':
      return 'Ready';
    case 'failed':
      return photo.error ?? 'Something went wrong.';
  }
}

/**
 * One photo in step 1 (design spec 5.4): thumbnail, status, caption, and every way to move,
 * replace or remove it. Reordering works by dragging the grip, by keyboard on the grip (Space to
 * pick up, arrows to move, Space to drop, Escape to cancel), and with the Earlier and Later
 * buttons, which are the single-pointer alternative required by WCAG 2.5.7.
 */
export function PhotoRow({ photo, index, total, listRef }: PhotoRowProps) {
  const setCaption = useBuilderStore((state) => state.setCaption);
  const movePhoto = useBuilderStore((state) => state.movePhoto);
  const replaceInput = useRef<HTMLInputElement>(null);
  const gripRef = useRef<HTMLButtonElement>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [grabbed, setGrabbed] = useState(false);
  const dragPointer = useRef<number | null>(null);
  const grabOrigin = useRef(index);
  const number = index + 1;

  const announceMove = (to: number) =>
    announce(`Photo ${number} moved to position ${to + 1} of ${total}`);

  const move = (to: number) => {
    if (to < 0 || to >= total || to === index) return;
    movePhoto(photo.localId, to);
    announceMove(to);
    // The row keeps its key, so the control that was used keeps focus.
  };

  const targetIndexFor = (clientY: number): number => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-row-id]');
    if (!rows || rows.length === 0) return index;
    let best = index;
    let bestDistance = Infinity;
    rows.forEach((row, rowIndex) => {
      const box = row.getBoundingClientRect();
      if (clientY >= box.top && clientY <= box.bottom) {
        best = rowIndex;
        bestDistance = -1;
      } else if (bestDistance >= 0) {
        const distance = Math.min(Math.abs(clientY - box.top), Math.abs(clientY - box.bottom));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = rowIndex;
        }
      }
    });
    return best;
  };

  const onGripPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onGripPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== dragPointer.current) return;
    const current = useBuilderStore.getState().photos.findIndex((p) => p.localId === photo.localId);
    const target = targetIndexFor(event.clientY);
    if (target !== current) movePhoto(photo.localId, target);
  };
  const onGripPointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== dragPointer.current) return;
    dragPointer.current = null;
    setDragging(false);
    const finalIndex = useBuilderStore
      .getState()
      .photos.findIndex((p) => p.localId === photo.localId);
    announceMove(finalIndex);
  };

  const onGripKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!grabbed) {
        grabOrigin.current = index;
        setGrabbed(true);
        announce(`Picked up photo ${number}. Use the arrow keys to move it, and Space to drop it.`);
      } else {
        setGrabbed(false);
        announceMove(index);
      }
    } else if (grabbed && event.key === 'ArrowUp') {
      event.preventDefault();
      move(index - 1);
    } else if (grabbed && event.key === 'ArrowDown') {
      event.preventDefault();
      move(index + 1);
    } else if (grabbed && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      movePhoto(photo.localId, grabOrigin.current);
      setGrabbed(false);
      announce(`Move cancelled. Photo ${number} is back at position ${grabOrigin.current + 1}.`);
    }
  };

  const busy =
    photo.status === 'processing' || photo.status === 'uploading' || photo.status === 'queued';

  return (
    <li
      className={['photo-row', dragging && 'is-dragging', grabbed && 'is-grabbed']
        .filter(Boolean)
        .join(' ')}
      data-row-id={photo.localId}
    >
      <div className="photo-row__top">
        <button
          ref={gripRef}
          type="button"
          className="photo-row__grip ui-gesture"
          aria-label={`Reorder photo ${number}`}
          aria-pressed={grabbed}
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={onGripPointerEnd}
          onPointerCancel={onGripPointerEnd}
          onKeyDown={onGripKeyDown}
          onBlur={() => setGrabbed(false)}
        >
          <Icon name="grip" />
        </button>
        <span
          className="photo-row__thumb"
          style={photo.lqip ? { backgroundImage: `url(${photo.lqip})` } : undefined}
        >
          {photo.wallUrl ? <img src={photo.wallUrl} alt="" /> : null}
        </span>
        <div className="photo-row__info">
          <h3 className="photo-row__title">Photo {number}</h3>
          <p className="photo-row__file user-text muted">{photo.fileName}</p>
          {photo.status === 'failed' ? (
            <p className="photo-row__status photo-row__status--failed" role="alert">
              <Icon name="alert" size="sm" /> {statusText(photo)}
            </p>
          ) : (
            <p
              className={[
                'photo-row__status',
                photo.status === 'ready' && 'photo-row__status--ready',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {photo.status === 'ready' ? <Icon name="check" size="sm" /> : null}{' '}
              {statusText(photo)}
            </p>
          )}
        </div>
      </div>

      {photo.status === 'uploading' ? (
        <ProgressBar value={photo.progress} label={`Photo ${number} upload`} />
      ) : null}

      {photo.status === 'failed' ? (
        <div className="row">
          {RETRYABLE.includes(photo.errorKind) ? (
            <Button variant="primary" icon="retry" onClick={() => retryPhoto(photo.localId)}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      <LimitedField
        id={`caption-${photo.localId}`}
        label="Caption (optional)"
        helper="This is what your guide says about the photo."
        value={photo.caption}
        onChange={(value) => setCaption(photo.localId, value)}
        max={LIMITS.captionMaxChars}
        multiline
        rows={3}
        lang="en-AU"
        spellCheck
      />

      {confirmingRemove ? (
        <div className="photo-row__confirm" role="group" aria-label={`Remove photo ${number}`}>
          <p>Remove photo {number} and its caption?</p>
          <div className="row">
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                removePhoto(photo.localId);
                announce('Photo removed');
              }}
            >
              Remove
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingRemove(false)}>
              Keep
            </Button>
          </div>
        </div>
      ) : (
        <div className="photo-row__actions">
          {index > 0 ? (
            <Button variant="tertiary" icon="up" onClick={() => move(index - 1)}>
              Earlier
              <span className="visually-hidden"> (move photo {number} up)</span>
            </Button>
          ) : null}
          {index < total - 1 ? (
            <Button variant="tertiary" icon="down" onClick={() => move(index + 1)}>
              Later
              <span className="visually-hidden"> (move photo {number} down)</span>
            </Button>
          ) : null}
          <Button
            variant="tertiary"
            onClick={() => replaceInput.current?.click()}
            unavailable={busy && photo.status !== 'queued'}
          >
            Replace<span className="visually-hidden"> photo {number}</span>
          </Button>
          <Button variant="tertiary" onClick={() => setConfirmingRemove(true)}>
            Remove<span className="visually-hidden"> photo {number}</span>
          </Button>
          <input
            ref={replaceInput}
            type="file"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file)
                void replacePhoto(photo.localId, file).then(
                  (ok) => ok && announce(`Photo ${number} replaced`),
                );
            }}
          />
        </div>
      )}
    </li>
  );
}
