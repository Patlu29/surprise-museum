import { useId } from 'react';
import { useExitingItems } from '@/hooks/useExitingItems';
import type { DraftIssue } from '@/state/draft';
import { Icon } from '@/ui/components/Icon';
import {
  sortByStep,
  stillToDoLabel,
  STILL_TO_DO_HEADING,
  STILL_TO_DO_READY,
} from './stepCopy';

interface StillToDoProps {
  /** Issues from `validateDraft(..., 'publish')`: the same list the Preview dialog filters. */
  issues: readonly DraftIssue[];
  /** Goes to the step and focuses the field, as the Preview dialog's links do. */
  onSelect: (issue: DraftIssue) => void;
  /** `rail` is the desktop copy in the left rail; the other is in the content flow. */
  placement: 'inline' | 'rail';
}

/**
 * The "Still to do" region (design spec 12.4.3, FR-85): what is left before the museum can be
 * published, as chips. It is never a live region and is never announced, so it cannot chatter.
 * It is rendered twice, in the flow (phones and tablets) and in the desktop rail; CSS shows one
 * and the other is `display: none`, so it is in the accessibility tree once.
 */
export function StillToDo({ issues, onSelect, placement }: StillToDoProps) {
  const headingId = useId();
  const sorted = sortByStep(issues);
  const rows = useExitingItems(sorted, (issue) => issue.id);
  return (
    <section
      className={`still-to-do still-to-do--${placement}`}
      aria-labelledby={headingId}
    >
      <p id={headingId} className="still-to-do__heading">
        {STILL_TO_DO_HEADING}
      </p>
      {rows.length === 0 ? (
        <p className="still-to-do__ready">
          <Icon name="check" size="sm" /> {STILL_TO_DO_READY}
        </p>
      ) : (
        <ul className="still-to-do__list">
          {rows.map(({ item, leaving }) => (
            <li
              key={item.id}
              className={leaving ? 'still-to-do__item is-leaving' : 'still-to-do__item'}
              aria-hidden={leaving ? true : undefined}
              inert={leaving}
            >
              <button type="button" className="still-to-do__chip" onClick={() => onSelect(item)}>
                <Icon name="circle" size="sm" />
                <span>{stillToDoLabel(item)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
