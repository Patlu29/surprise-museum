import { useRef } from 'react';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';

interface ContextLostDialogProps {
  open: boolean;
  /** In a preview, reloading would lose the draft, so the action goes back to the builder instead. */
  preview: boolean;
  onAction: () => void;
}

/** "The 3D view stopped" (design spec 7.8, NFR-11): a blocking alert dialog with one way forward. */
export function ContextLostDialog({ open, preview, onAction }: ContextLostDialogProps) {
  const actionRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={() => undefined}
      dismissible={false}
      role="alertdialog"
      title="The 3D view stopped"
      description="This can happen when a phone is low on memory."
      initialFocusRef={actionRef}
    >
      <p>
        {preview
          ? 'Your draft is safe. Go back to it and try the preview again.'
          : "Your place in the museum won't be kept."}
      </p>
      <div className="dialog__actions">
        <Button ref={actionRef} variant="primary" onClick={onAction}>
          {preview ? 'Back to my draft' : 'Reload'}
        </Button>
      </div>
    </Dialog>
  );
}
