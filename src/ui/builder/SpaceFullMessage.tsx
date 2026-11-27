import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { useBuilderStore } from '@/state/builderStore';
import { retrySpaceFull } from '@/state/uploadQueue';
import { Button } from '@/ui/components/Button';
import { FrameMark } from '@/ui/components/FrameMark';
import {
  SPACE_FULL_BACK,
  SPACE_FULL_HEADING,
  SPACE_FULL_PARAGRAPHS,
  SPACE_FULL_TRY_AGAIN,
} from './spaceFullCopy';

interface SpaceFullMessageProps {
  /** Where focus goes on close if the control that had it has gone: the current step's heading. */
  fallbackFocus: () => void;
}

/**
 * The space-full message (FR-106, design spec 13.2): a modal alertdialog over the builder, open
 * while `builderStore.spaceFull` is set. Exactly two controls, no close icon, and a tap on the
 * scrim does nothing. Focus goes to the heading, Tab wraps between the two buttons and Escape is
 * Back to my museum. It is announced by its role, so it needs no live region of its own.
 */
export function SpaceFullMessage({ fallbackFocus }: SpaceFullMessageProps) {
  const open = useBuilderStore((state) => state.spaceFull !== null);
  return open ? <SpaceFullDialog fallbackFocus={fallbackFocus} /> : null;
}

function SpaceFullDialog({ fallbackFocus }: SpaceFullMessageProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tryRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const fallbackRef = useRef(fallbackFocus);
  const headingId = useId();
  const firstId = useId();
  const secondId = useId();
  useEffect(() => {
    fallbackRef.current = fallbackFocus;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (previous && previous !== document.body && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      } else {
        fallbackRef.current();
      }
    };
  }, []);

  // Back to my museum only closes the message: nothing else in the draft changes (FR-106 (c)).
  const back = () => useBuilderStore.getState().setSpaceFull(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      back();
      return;
    }
    if (event.key !== 'Tab') return;
    // The two buttons form a loop; the heading is not a tab stop (design spec 13.2).
    const active = document.activeElement;
    if (event.shiftKey && (active === tryRef.current || active === headingRef.current)) {
      event.preventDefault();
      backRef.current?.focus();
    } else if (!event.shiftKey && active === backRef.current) {
      event.preventDefault();
      tryRef.current?.focus();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={`${firstId} ${secondId}`}
      className="space-full"
      onKeyDown={onKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        back();
      }}
    >
      <div className="space-full__card surface-paper">
        <span className="space-full__mark" aria-hidden="true">
          <FrameMark />
        </span>
        <h2 ref={headingRef} id={headingId} tabIndex={-1} className="space-full__heading">
          {SPACE_FULL_HEADING}
        </h2>
        <p id={firstId} className="space-full__text">
          {SPACE_FULL_PARAGRAPHS[0]}
        </p>
        <p id={secondId} className="space-full__text">
          {SPACE_FULL_PARAGRAPHS[1]}
        </p>
        <div className="space-full__actions">
          <Button ref={tryRef} variant="primary" large onClick={() => retrySpaceFull()}>
            {SPACE_FULL_TRY_AGAIN}
          </Button>
          <Button ref={backRef} variant="secondary" medium onClick={back}>
            {SPACE_FULL_BACK}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
