import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import type { Placement } from './chooseCaptionDock';

interface CaptionCardProps {
  placement: Placement;
  guideName: string;
  /** CSS variable holding the Guide's outfit colour, for the badge. */
  badgeColor: string;
  /** Letter colour chosen for 4.5:1 against the badge. */
  badgeInk: 'dark' | 'light';
  /** "Photo 3 of 12" */
  label: string;
  caption: string;
  cardRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onLookCloser: () => void;
  onScrollActivity: () => void;
}

/**
 * The Guide's caption card (design spec 5.6). Not a dialog: it never traps or steals focus.
 * Announcement is by the separate live region. Docked by `chooseCaptionDock`; a strip shows two
 * lines with Read more, and expanding is the Visitor's own choice.
 */
export function CaptionCard({
  placement,
  guideName,
  badgeColor,
  badgeInk,
  label,
  caption,
  cardRef,
  onClose,
  onLookCloser,
  onScrollActivity,
}: CaptionCardProps) {
  const headingId = useId();
  const textId = useId();
  const labelId = useId();
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const refocusToggle = useRef(false);
  const toggleFocused = useRef(false);
  const strip = placement.size === 'strip' && !expanded;
  const rect = placement.size === 'strip' && expanded ? placement.expandedRect : placement.rect;

  // Every placement change (an upgrade or a move) restarts a short cross-fade on the same
  // element; focus is untouched. Adjusting state while rendering is the supported pattern.
  const geometry = `${placement.size}:${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
  const [seenGeometry, setSeenGeometry] = useState(geometry);
  const [swaps, setSwaps] = useState(0);
  if (geometry !== seenGeometry) {
    setSeenGeometry(geometry);
    setSwaps((count) => count + 1);
  }

  // Is the caption cut off at two lines? Measured while clamped, and again on resize and font load.
  useEffect(() => {
    const el = textRef.current;
    if (!el || !strip) return;
    const measure = () => setTruncated(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [strip, caption, placement.rect.width, placement.rect.height]);

  // The toggle moves between the header (strip) and the foot (expanded): keep focus on it.
  useLayoutEffect(() => {
    if (refocusToggle.current) {
      refocusToggle.current = false;
      toggleRef.current?.focus({ preventScroll: true });
    }
  }, [expanded]);

  // If an upgrade removed Read more while it had focus, focus moves to Close (design spec 3.5).
  useEffect(() => {
    if (placement.size !== 'strip' && toggleFocused.current) {
      toggleFocused.current = false;
      closeRef.current?.focus({ preventScroll: true });
    }
  }, [placement.size]);

  const style: CSSProperties = {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    ...(strip ? { height: rect.height } : { maxHeight: rect.height }),
    ['--badge-color' as string]: badgeColor,
    ...(swaps > 0 ? { animationName: swaps % 2 ? 'card-swap-a' : 'card-swap-b' } : null),
  };

  const canExpand = placement.size === 'strip' && (truncated || expanded);
  const toggle = canExpand ? (
    <Button
      ref={toggleRef}
      variant="tertiary"
      className="caption-card__toggle"
      aria-expanded={expanded}
      aria-controls={textId}
      onFocus={() => {
        toggleFocused.current = true;
      }}
      onBlur={() => {
        toggleFocused.current = false;
      }}
      onClick={() => {
        refocusToggle.current = true;
        setExpanded((value) => !value);
      }}
    >
      {/* Icon-only below 18 rem of card content; the words stay in the DOM for assistive tech. */}
      <Icon name={expanded ? 'up' : 'down'} size="sm" className="caption-card__toggle-icon" />
      <span className="caption-card__toggle-text">{expanded ? 'Show less' : 'Read more'}</span>
    </Button>
  ) : null;
  // In a strip a cut-off caption trades Look closer for Read more; otherwise Look closer stays.
  const showLook = !(strip && canExpand);

  return (
    <section
      ref={cardRef}
      role="region"
      aria-labelledby={`${headingId} ${labelId}`}
      className={[
        'caption-card',
        'surface-paper',
        'ui-hit',
        strip && 'is-strip',
        placement.size === 'fitted' && 'is-fitted',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      data-dock={placement.dock}
      data-card-size={strip ? 'strip' : placement.size === 'strip' ? 'full' : placement.size}
      data-expanded={expanded || undefined}
      onPointerDown={onScrollActivity}
    >
      <header className="caption-card__header">
        <span className={`caption-card__badge caption-card__badge--${badgeInk}`} aria-hidden="true">
          {[...guideName.trim()][0]?.toUpperCase() ?? '?'}
        </span>
        <div className="caption-card__title">
          <h2 id={headingId} className="caption-card__name user-text">
            {guideName}
          </h2>
          <p id={labelId} className="caption-card__label">{label}</p>
        </div>
        {strip ? toggle : null}
        {showLook ? (
          <Button
            variant="secondary"
            icon="eye"
            className="caption-card__look"
            aria-label={`Look closer at ${label.toLowerCase()}`}
            onClick={onLookCloser}
          >
            <span className="caption-card__look-text">Look closer</span>
          </Button>
        ) : null}
        <Button
          ref={closeRef}
          variant="tertiary"
          icon="close"
          aria-label="Close caption"
          onClick={onClose}
        />
      </header>
      <div
        className="caption-card__body"
        tabIndex={strip ? -1 : 0}
        role="group"
        aria-label="Caption"
        onScroll={onScrollActivity}
      >
        <p id={textId} ref={textRef} className="caption-card__text user-text">
          {caption}
        </p>
      </div>
      {!strip ? <div className="caption-card__more">{toggle}</div> : null}
    </section>
  );
}
