import { useId, type ReactNode } from 'react';

interface StepSectionProps {
  title: string;
  /** Required and Optional are always words, never colour alone (design spec 12.1, FR-86). */
  tag?: 'required' | 'optional';
  /** A short note after the tag, for example "at least 1 photo". */
  note?: string;
  /** `emphasis` is the Required card with the claret bar (design spec 12.5.2). */
  variant?: 'plain' | 'emphasis' | 'quiet';
  className?: string;
  children: ReactNode;
}

/** A labelled card with an h2 and a Required or Optional tag (design spec 12.5). */
export function StepSection({
  title,
  tag,
  note,
  variant = 'plain',
  className,
  children,
}: StepSectionProps) {
  const headingId = useId();
  return (
    <section
      className={['step-card', `step-card--${variant}`, className].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
    >
      <header className="step-card__head">
        <h2 id={headingId} className="step-card__title">
          {title}
        </h2>
        {tag ? (
          <span className={`tag tag--${tag}`}>{tag === 'required' ? 'Required' : 'Optional'}</span>
        ) : null}
        {note ? <span className="step-card__note">{note}</span> : null}
      </header>
      {children}
    </section>
  );
}
