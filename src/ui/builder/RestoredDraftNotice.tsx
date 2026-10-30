import { useEffect, useState } from 'react';
import type { BuilderStep } from '@/state/draft';
import { announce } from '@/state/announcer';
import { useBuilderStore } from '@/state/builderStore';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';

/** Copy deck, "Restored draft notice" (design spec 5.17 and section 10). */
export const RESTORED_NOTICE_LINE_1 = "Photos aren't kept after a reload. Please add them again.";
export const RESTORED_NOTICE_LINE_2 = 'Your names, words and characters are still here.';
export const RESTORED_NOTICE_ANNOUNCEMENT = `${RESTORED_NOTICE_LINE_1} ${RESTORED_NOTICE_LINE_2}`;

/** Delay after the step announcement, so the notice queues behind it (design spec 5.17). */
export const RESTORED_NOTICE_ANNOUNCE_DELAY_MS = 600;
/** How long a removed notice stays mounted so it can fade and collapse (`--duration-fast`). */
const LEAVE_MS = 200;

interface RestoredDraftNoticeProps {
  step: BuilderStep;
  /** Goes to step 1, which moves focus to its heading as any step change does. */
  onAddPhotos: () => void;
  /** Called after Dismiss, to move focus to the step heading (the button has left the page). */
  onDismissed: () => void;
}

/**
 * The inline "Photos aren't kept" information notice (design spec 5.17). It is not an alert: it
 * never takes focus and has no live-region role of its own. The one polite announcement goes
 * through the shared announcer, about 600 ms after the step announcement, once per page load.
 * Removal (a photo added, Dismiss, publish or a new draft) is silent.
 */
export function RestoredDraftNotice({ step, onAddPhotos, onDismissed }: RestoredDraftNoticeProps) {
  const wanted = useBuilderStore((state) => state.restoredDraftNotice);
  const announced = useBuilderStore((state) => state.restoredDraftNoticeAnnounced);
  const dismiss = useBuilderStore((state) => state.dismissRestoredDraftNotice);
  const markAnnounced = useBuilderStore((state) => state.markRestoredDraftNoticeAnnounced);
  const [mounted, setMounted] = useState(wanted);

  useEffect(() => {
    // The notice is only ever switched on at restore time, so it only has to be unmounted here.
    if (wanted) return;
    const timer = window.setTimeout(() => setMounted(false), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [wanted]);

  useEffect(() => {
    if (!wanted || announced) return;
    const timer = window.setTimeout(() => {
      announce(RESTORED_NOTICE_ANNOUNCEMENT);
      markAnnounced();
    }, RESTORED_NOTICE_ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [wanted, announced, markAnnounced]);

  if (!mounted) return null;
  return (
    <RestoredDraftNoticeView
      step={step}
      leaving={!wanted}
      onAddPhotos={onAddPhotos}
      onDismiss={() => {
        dismiss();
        onDismissed();
      }}
    />
  );
}

interface ViewProps {
  step: BuilderStep;
  /** True while the notice fades out after removal; it is hidden from assistive technology. */
  leaving: boolean;
  onAddPhotos: () => void;
  onDismiss: () => void;
}

/** The notice's markup, apart from its state, so it can be tested without a store. */
export function RestoredDraftNoticeView({ step, leaving, onAddPhotos, onDismiss }: ViewProps) {
  return (
    <div
      className={['restored-notice', leaving && 'is-leaving'].filter(Boolean).join(' ')}
      aria-hidden={leaving ? true : undefined}
      inert={leaving}
    >
      <Icon name="info" className="restored-notice__icon" />
      <div className="restored-notice__body">
        <p className="restored-notice__title">{RESTORED_NOTICE_LINE_1}</p>
        <p className="restored-notice__detail">{RESTORED_NOTICE_LINE_2}</p>
        {step > 1 ? (
          <div>
            <Button variant="tertiary" onClick={onAddPhotos}>
              Add photos
            </Button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="btn btn--tertiary btn--icon"
        aria-label="Dismiss notice"
        onClick={onDismiss}
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
