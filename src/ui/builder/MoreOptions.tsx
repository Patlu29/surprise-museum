import { useId, type ReactNode } from 'react';
import { Icon } from '@/ui/components/Icon';
import { MORE_OPTIONS_LABEL } from './extraOptions';

interface MoreOptionsProps {
  /** Whether this tab has a disclosure at all. Body and Hair do not: Reset sits alone. */
  available: boolean;
  open: boolean;
  onToggle: () => void;
  /** Groups inside that are off their default. A changed value is never hidden (12.5.3). */
  changed: number;
  /** The Reset button. It shares the row with the disclosure button so the closed step is no taller. */
  reset: ReactNode;
  /** The groups, shown under the row when open. */
  children?: ReactNode;
}

/**
 * The "More options" disclosure on the Characters step (design spec 12.5.3, FR-102). The row holds
 * the button on the left and Reset on the right, one 44 px row either way. The content is
 * `hidden` while closed, so it leaves the tab order and the accessibility tree. Choices are kept
 * when it closes.
 */
export function MoreOptions({ available, open, onToggle, changed, reset, children }: MoreOptionsProps) {
  const panelId = useId();
  return (
    <>
      <div className="characters__footer">
        {available ? (
          <button
            type="button"
            className="more-options__button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
          >
            <span>{MORE_OPTIONS_LABEL}</span>
            {changed > 0 ? (
              <span className="more-options__count">
                {changed}
                <span className="visually-hidden"> changed</span>
              </span>
            ) : null}
            <Icon name="chevron" size="sm" className="more-options__chevron" />
          </button>
        ) : null}
        {reset}
      </div>
      {available ? (
        <div id={panelId} className="more-options__panel stack" hidden={!open}>
          {children}
        </div>
      ) : null}
    </>
  );
}
