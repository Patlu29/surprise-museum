import { LIMITS } from '@contract';
import { formatEndDateTime } from '@/lib/format';
import { Icon } from './Icon';

interface AvailabilityNoticeProps {
  /** The server's `expiresAt` (ISO 8601). Missing or invalid shows the fallback line. */
  expiresAt: string | null | undefined;
  context: 'published' | 'edit';
}

const SECOND_LINE = {
  published: 'Deleting it with your edit link ends it sooner.',
  edit: 'You can end it sooner by deleting it below.',
} as const;

/**
 * How long the museum lasts and when it ends (design spec 5.18, FR-105, US-71). Plain static text:
 * no role, no live region and no label, so a screen reader reads it in order with the page.
 */
export function AvailabilityNotice({ expiresAt, context }: AvailabilityNoticeProps) {
  const end = formatEndDateTime(expiresAt);
  return (
    <div className="availability">
      <Icon name="info" size="sm" className="availability__icon" />
      <div className="availability__text">
        <p className="availability__line">
          {end && expiresAt ? (
            <>
              Available for {LIMITS.retentionDays} days, until{' '}
              <time dateTime={expiresAt}>{end}</time>.
            </>
          ) : (
            <>Available for {LIMITS.retentionDays} days.</>
          )}
        </p>
        <p className="availability__more">{SECOND_LINE[context]}</p>
      </div>
    </div>
  );
}
