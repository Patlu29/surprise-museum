import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { MuseumPhoto } from '@contract';
import { focusCanvas } from '@/hooks/canvasFocus';
import { photoLabel } from '@/lib/announcements';
import { clearInput } from '@/state/inputState';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';
import type { ViewTransform } from './viewerMath';
import { clampPan, IDENTITY, MAX_SCALE, toggleZoom, zoomAt } from './viewerMath';

interface PhotoViewerProps {
  photo: MuseumPhoto;
  index: number;
  total: number;
  onClose: () => void;
}

type LoadState = 'loading' | 'loaded' | 'error';

const KEY_ZOOM_FACTOR = 1.25;
const KEY_PAN_STEP = 60;
const DOUBLE_TAP_MS = 320;
const TAP_SLOP_PX = 8;

/**
 * Full-screen photo (design spec 5.8, FR-35). Modal dialog; focus starts on Close and returns to
 * the canvas. Zoom: pinch, wheel, double-tap or double-click, plus and minus keys, and buttons.
 * Pan: drag or arrow keys when zoomed, clamped to the image. The caption sits on its own band
 * below the photo, never over it.
 */
export function PhotoViewer({ photo, index, total, onClose }: PhotoViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [load, setLoad] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);
  const [transform, setTransform] = useState<ViewTransform>(IDENTITY);
  const transformRef = useRef<ViewTransform>(IDENTITY);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ distance: number; scale: number } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const tapStart = useRef<{ x: number; y: number } | null>(null);

  const caption = photo.caption.trim();
  const alt = caption || photoLabel(index, total);

  useEffect(() => {
    clearInput();
  }, []);

  const apply = useCallback((next: ViewTransform) => {
    transformRef.current = next;
    setTransform(next);
  }, []);

  const sizes = useCallback(() => {
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage || !image) return null;
    return {
      container: { width: stage.clientWidth, height: stage.clientHeight },
      content: { width: image.offsetWidth, height: image.offsetHeight },
      rect: stage.getBoundingClientRect(),
    };
  }, []);

  const zoomBy = useCallback(
    (factor: number, focal?: { x: number; y: number }) => {
      const measured = sizes();
      if (!measured) return;
      apply(
        zoomAt(
          transformRef.current,
          transformRef.current.scale * factor,
          focal ?? { x: 0, y: 0 },
          measured.content,
          measured.container,
        ),
      );
    },
    [apply, sizes],
  );

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const measured = sizes();
      if (!measured) return;
      const focal = {
        x: event.clientX - (measured.rect.left + measured.rect.width / 2),
        y: event.clientY - (measured.rect.top + measured.rect.height / 2),
      };
      const next = transformRef.current.scale * Math.exp(-event.deltaY * 0.0015);
      apply(zoomAt(transformRef.current, next, focal, measured.content, measured.container));
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [apply, sizes]);

  // Keep the pan inside the image when the window is resized or rotated.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const measured = sizes();
      if (measured) apply(clampPan(transformRef.current, measured.content, measured.container));
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [apply, sizes]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) tapStart.current = { x: event.clientX, y: event.clientY };
    else tapStart.current = null;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a && b) {
        gesture.current = {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          scale: transformRef.current.scale,
        };
      }
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);
    const measured = sizes();
    if (!measured) return;

    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const focal = {
        x: (a.x + b.x) / 2 - (measured.rect.left + measured.rect.width / 2),
        y: (a.y + b.y) / 2 - (measured.rect.top + measured.rect.height / 2),
      };
      const next = gesture.current.scale * (distance / Math.max(1, gesture.current.distance));
      apply(zoomAt(transformRef.current, next, focal, measured.content, measured.container));
      return;
    }
    if (pointers.current.size === 1 && transformRef.current.scale > 1) {
      apply(
        clampPan(
          {
            scale: transformRef.current.scale,
            x: transformRef.current.x + (current.x - previous.x),
            y: transformRef.current.y + (current.y - previous.y),
          },
          measured.content,
          measured.container,
        ),
      );
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    const start = tapStart.current;
    tapStart.current = null;
    if (!wasSingle || !start) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved > TAP_SLOP_PX) return;

    const now = event.timeStamp;
    const previous = lastTap.current;
    const onImage = (event.target as Element).closest('.viewer__image') !== null;
    if (
      previous &&
      now - previous.time < DOUBLE_TAP_MS &&
      Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < TAP_SLOP_PX * 4
    ) {
      lastTap.current = null;
      const measured = sizes();
      if (!measured) return;
      apply(
        toggleZoom(
          transformRef.current,
          {
            x: event.clientX - (measured.rect.left + measured.rect.width / 2),
            y: event.clientY - (measured.rect.top + measured.rect.height / 2),
          },
          measured.content,
          measured.container,
        ),
      );
      return;
    }
    lastTap.current = { time: now, x: event.clientX, y: event.clientY };
    // A tap on the dark background, outside the photo, closes the viewer when not zoomed.
    if (!onImage && transformRef.current.scale <= 1.01) {
      window.setTimeout(() => {
        if (lastTap.current && lastTap.current.time === now) onClose();
      }, DOUBLE_TAP_MS);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const measured = sizes();
    switch (event.key) {
      case '+':
      case '=':
        event.preventDefault();
        zoomBy(KEY_ZOOM_FACTOR);
        break;
      case '-':
      case '_':
        event.preventDefault();
        zoomBy(1 / KEY_ZOOM_FACTOR);
        break;
      case '0':
        event.preventDefault();
        apply(IDENTITY);
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        if (transformRef.current.scale <= 1 || !measured) break;
        event.preventDefault();
        const dx =
          event.key === 'ArrowLeft' ? KEY_PAN_STEP : event.key === 'ArrowRight' ? -KEY_PAN_STEP : 0;
        const dy =
          event.key === 'ArrowUp' ? KEY_PAN_STEP : event.key === 'ArrowDown' ? -KEY_PAN_STEP : 0;
        apply(
          clampPan(
            {
              scale: transformRef.current.scale,
              x: transformRef.current.x + dx,
              y: transformRef.current.y + dy,
            },
            measured.content,
            measured.container,
          ),
        );
        break;
      }
      default:
        break;
    }
  };

  const zoomed = transform.scale > 1.01;

  return (
    <Dialog
      open
      onClose={onClose}
      title={photoLabel(index, total)}
      titleHidden
      variant="viewer"
      initialFocusRef={closeRef}
      returnFocus={focusCanvas}
    >
      <div className="viewer" onKeyDown={onKeyDown}>
        <div className="viewer__top">
          <p className="viewer__count">{photoLabel(index, total)}</p>
          <Button
            ref={closeRef}
            variant="night"
            icon="close"
            aria-label="Close photo"
            onClick={onClose}
          />
        </div>

        <div
          ref={stageRef}
          className="viewer__stage ui-gesture"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {photo.lqip ? (
            <img
              className={['viewer__lqip', load === 'error' && 'is-dimmed']
                .filter(Boolean)
                .join(' ')}
              src={photo.lqip}
              alt=""
              aria-hidden="true"
            />
          ) : null}
          {load !== 'error' ? (
            <img
              key={attempt}
              ref={imageRef}
              className={['viewer__image', load === 'loaded' && 'is-loaded']
                .filter(Boolean)
                .join(' ')}
              src={photo.fullUrl}
              alt={alt}
              draggable={false}
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              }}
              onLoad={() => setLoad('loaded')}
              onError={() => setLoad('error')}
            />
          ) : null}
          {load === 'loading' ? (
            <p className="viewer__chip" role="status">
              Loading full photo...
            </p>
          ) : null}
          {load === 'error' ? (
            <div className="viewer__error" role="alert">
              <p>We couldn&apos;t load this photo.</p>
              <div className="row">
                <Button
                  variant="night-primary"
                  icon="retry"
                  onClick={() => {
                    setLoad('loading');
                    setAttempt((value) => value + 1);
                  }}
                >
                  Try again
                </Button>
                <Button variant="night" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="viewer__bottom">
          {caption ? (
            <div className="viewer__caption" tabIndex={0} role="group" aria-label="Caption">
              <p className="user-text">{caption}</p>
            </div>
          ) : (
            <span />
          )}
          <div className="viewer__zoom" role="group" aria-label="Zoom">
            <Button
              variant="night"
              icon="minus"
              aria-label="Zoom out"
              unavailable={!zoomed}
              onClick={() => zoomBy(1 / KEY_ZOOM_FACTOR)}
            />
            <Button
              variant="night"
              icon="reset"
              aria-label="Reset zoom"
              unavailable={!zoomed}
              onClick={() => apply(IDENTITY)}
            />
            <Button
              variant="night"
              icon="plus"
              aria-label="Zoom in"
              unavailable={transform.scale >= MAX_SCALE}
              onClick={() => zoomBy(KEY_ZOOM_FACTOR)}
            />
          </div>
        </div>
        <p className="visually-hidden">
          Press plus or minus to zoom, zero to reset, arrow keys to move a zoomed photo, and Escape
          to close.
        </p>
      </div>
    </Dialog>
  );
}
