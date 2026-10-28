import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';

interface DialogProps {
  open: boolean;
  /** Called for Escape and the native close event. Ignored when `dismissible` is false. */
  onClose: () => void;
  title: string;
  /** Hide the visible title (the dialog still has an accessible name). */
  titleHidden?: boolean;
  description?: string;
  /** `alertdialog` for destructive and blocking messages (design spec 5.14). */
  role?: 'dialog' | 'alertdialog';
  dismissible?: boolean;
  /** The control that gets focus first. Defaults to the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Where focus goes on close. Defaults to the element focused before opening. */
  returnFocus?: () => void;
  /** A control shown beside the title, for example a sheet's Close button. */
  headerAction?: ReactNode;
  variant?: 'dialog' | 'sheet' | 'viewer';
  className?: string;
  children: ReactNode;
}

/**
 * A modal built on the native <dialog>: top-layer stacking, inert background, focus trap and
 * Escape come from the browser. Children mount only while open, so initial focus is reliable.
 */
export function Dialog(props: DialogProps) {
  return props.open ? <DialogInner {...props} /> : null;
}

function DialogInner({
  onClose,
  title,
  titleHidden,
  description,
  role = 'dialog',
  dismissible = true,
  initialFocusRef,
  returnFocus,
  headerAction,
  variant = 'dialog',
  className,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  const returnFocusRef = useRef(returnFocus);
  useEffect(() => {
    onCloseRef.current = onClose;
    returnFocusRef.current = returnFocus;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    const target = initialFocusRef?.current;
    if (target) target.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (returnFocusRef.current) returnFocusRef.current();
      else if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
    // Focus is set once, when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={['dialog', `dialog--${variant}`, className].filter(Boolean).join(' ')}
      onCancel={(event) => {
        // Escape. Blocking dialogs (context lost) must not close.
        event.preventDefault();
        if (dismissible) onCloseRef.current();
      }}
    >
      <div className="dialog__header">
        <h2 id={titleId} className={titleHidden ? 'visually-hidden' : 'dialog__title'}>
          {title}
        </h2>
        {headerAction}
      </div>
      {description ? (
        <p id={descriptionId} className="dialog__description">
          {description}
        </p>
      ) : null}
      {children}
    </dialog>
  );
}
