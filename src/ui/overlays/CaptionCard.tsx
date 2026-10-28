import { useId, useState, type CSSProperties, type RefObject } from 'react';
import { Button } from '@/ui/components/Button';
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
  const [expanded, setExpanded] = useState(false);
  const strip = placement.size === 'strip' && !expanded;
  const rect = placement.size === 'strip' && expanded ? placement.expandedRect : placement.rect;

  const style: CSSProperties = {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    maxHeight: rect.height,
    ['--badge-color' as string]: badgeColor,
  };

  return (
    <section
      ref={cardRef}
      role="region"
      aria-labelledby={headingId}
      className={['caption-card', 'surface-paper', 'ui-hit', strip && 'is-strip']
        .filter(Boolean)
        .join(' ')}
      style={style}
      data-dock={placement.dock}
    >
      <header className="caption-card__header">
        <span className={`caption-card__badge caption-card__badge--${badgeInk}`} aria-hidden="true">
          {[...guideName.trim()][0]?.toUpperCase() ?? '?'}
        </span>
        <div className="caption-card__title">
          <h2 id={headingId} className="caption-card__name user-text">
            {guideName}
          </h2>
          <p className="caption-card__label">{label}</p>
        </div>
        <Button
          variant="secondary"
          icon="eye"
          className="caption-card__look"
          aria-label={`Look closer at ${label.toLowerCase()}`}
          onClick={onLookCloser}
        >
          <span className="caption-card__look-text">Look closer</span>
        </Button>
        <Button variant="tertiary" icon="close" aria-label="Close caption" onClick={onClose} />
      </header>
      <div
        className="caption-card__body"
        tabIndex={strip ? -1 : 0}
        role="group"
        aria-label="Caption"
        onScroll={onScrollActivity}
      >
        <p className="caption-card__text user-text">{caption}</p>
      </div>
      {placement.size === 'strip' ? (
        <div className="caption-card__more">
          <Button
            variant="tertiary"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? 'Show less' : 'Read more'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
