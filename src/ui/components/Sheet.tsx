import type { ReactNode, RefObject } from 'react';
import { focusCanvas } from '@/hooks/canvasFocus';
import { Button } from './Button';
import { Dialog } from './Dialog';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * Picture list, settings and help: a bottom sheet on phones in portrait and a right-hand drawer
 * otherwise (design spec 5.12). Modal, focus trapped, Escape closes, focus returns to the canvas.
 */
export function Sheet({ open, onClose, title, initialFocusRef, children }: SheetProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      variant="sheet"
      initialFocusRef={initialFocusRef}
      returnFocus={focusCanvas}
      headerAction={
        <Button variant="tertiary" icon="close" aria-label={`Close ${title}`} onClick={onClose} />
      }
    >
      <div className="sheet__body">{children}</div>
    </Dialog>
  );
}
