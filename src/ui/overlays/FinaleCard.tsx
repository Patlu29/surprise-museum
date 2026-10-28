import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { focusCanvas } from '@/hooks/canvasFocus';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';
import { Icon } from '@/ui/components/Icon';
import type { Placement } from './chooseCaptionDock';

interface FinaleCardProps {
  placement: Placement;
  guideName: string;
  visitorName: string;
  /** The Creator's closing message. Empty shows "The end" (FR-29). */
  message: string;
  cardRef: RefObject<HTMLElement | null>;
  onKeepExploring: () => void;
  onReplay: () => void;
}

/** Messages longer than this many characters offer a full-height reading sheet in compact docks. */
const COMPACT_LIMIT = 220;

/**
 * The finale card (design spec 5.7). Keep exploring is the primary action and Replay the
 * secondary. It is a decision point, so it takes focus on Keep exploring when it appears if the
 * focus was on the canvas. A blank message falls back to "The end / Thanks for visiting, {name}."
 */
export function FinaleCard({
  placement,
  guideName,
  visitorName,
  message,
  cardRef,
  onKeepExploring,
  onReplay,
}: FinaleCardProps) {
  const headingId = useId();
  const keepRef = useRef<HTMLButtonElement>(null);
  const [reading, setReading] = useState(false);
  const hasMessage = message.trim().length > 0;
  const compact =
    placement.size === 'strip' ||
    placement.layout === 'phone-portrait' ||
    placement.layout === 'phone-landscape';
  const clamp = compact && message.length > COMPACT_LIMIT;

  useEffect(() => {
    const active = document.activeElement;
    // Only take focus from the canvas (or nothing): never from a control the Visitor chose.
    if (
      !active ||
      active === document.body ||
      active.getAttribute('aria-roledescription') === '3D museum'
    ) {
      keepRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const rect = placement.rect;
  const style: CSSProperties = {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    maxHeight: rect.height,
  };
  const heading = hasMessage ? `A note from ${guideName}` : 'The end';

  const footer = (
    <div className="finale-card__footer">
      <Button ref={keepRef} variant="primary" onClick={onKeepExploring}>
        Keep exploring
      </Button>
      <Button variant="secondary" icon="reset" onClick={onReplay}>
        Replay from the start
      </Button>
    </div>
  );

  return (
    <>
      <section
        ref={cardRef}
        role="region"
        aria-labelledby={headingId}
        className="finale-card surface-paper ui-hit"
        style={style}
        data-dock={placement.dock}
      >
        <header className="finale-card__header">
          <span className="finale-card__seal" aria-hidden="true">
            <Icon name="heart" />
          </span>
          <h2 id={headingId} className="finale-card__heading user-text">
            {heading}
          </h2>
        </header>
        <div className="finale-card__body" tabIndex={0} role="group" aria-label="Message">
          <p
            className={['finale-card__text', 'user-text', clamp && 'is-clamped']
              .filter(Boolean)
              .join(' ')}
          >
            {hasMessage ? message : `Thanks for visiting, ${visitorName}.`}
          </p>
        </div>
        {clamp ? (
          <Button variant="tertiary" onClick={() => setReading(true)}>
            Read the whole note
          </Button>
        ) : null}
        {footer}
      </section>

      <Dialog
        open={reading}
        onClose={() => setReading(false)}
        title={heading}
        variant="sheet"
        returnFocus={() => {
          if (keepRef.current) keepRef.current.focus();
          else focusCanvas();
        }}
      >
        <div className="finale-card__reading">
          <p className="finale-card__text user-text">{message}</p>
        </div>
        <div className="finale-card__footer">
          <Button
            variant="primary"
            onClick={() => {
              setReading(false);
              onKeepExploring();
            }}
          >
            Keep exploring
          </Button>
          <Button
            variant="secondary"
            icon="reset"
            onClick={() => {
              setReading(false);
              onReplay();
            }}
          >
            Replay from the start
          </Button>
        </div>
      </Dialog>
    </>
  );
}
