import { useRef } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/ui/components/Button';
import { Sheet } from '@/ui/components/Sheet';

interface HelpSheetProps {
  open: boolean;
  onClose: () => void;
  guideName: string;
}

/** "How to explore" (design spec 3.3): the only way to re-read the coaching hints. */
export function HelpSheet({ open, onClose, guideName }: HelpSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const touch = useMediaQuery('(pointer: coarse)');
  return (
    <Sheet open={open} onClose={onClose} title="How to explore" initialFocusRef={closeRef}>
      <ol className="help-list">
        <li>
          <strong>Walk around.</strong> There is no set order. Go wherever you like.
        </li>
        <li>
          <strong>Pause by a picture.</strong> {guideName} will walk over and tell you about it.
        </li>
        <li>
          <strong>{touch ? 'Tap' : 'Click'} a picture</strong> to look closer. You can zoom in on
          it.
        </li>
      </ol>

      <table className="help-table">
        <caption className="visually-hidden">Controls</caption>
        <tbody>
          {touch ? (
            <>
              <tr>
                <th scope="row">Walk</th>
                <td>Drag the circle at the bottom, or turn on arrow buttons in Settings</td>
              </tr>
              <tr>
                <th scope="row">Look around</th>
                <td>Drag anywhere else</td>
              </tr>
            </>
          ) : null}
          <tr>
            <th scope="row">Walk</th>
            <td>W A S D or the arrow keys</td>
          </tr>
          <tr>
            <th scope="row">Turn the view</th>
            <td>Q and E, or Shift with the arrow keys. Drag with the mouse.</td>
          </tr>
          <tr>
            <th scope="row">Closer or further</th>
            <td>Plus and minus, or the mouse wheel</td>
          </tr>
          <tr>
            <th scope="row">Shortcuts</th>
            <td>
              R resets the view, P opens Pictures, N asks where next, H opens this help, Escape
              closes panels
            </td>
          </tr>
        </tbody>
      </table>

      <p className="muted">
        Everything works with a keyboard. Press Tab to move between buttons, and Tab again to leave
        the museum view. If you cannot drag, turn on arrow buttons in Settings, or use the Pictures
        list to go straight to any picture.
      </p>
      <Button ref={closeRef} variant="primary" onClick={onClose}>
        Got it
      </Button>
    </Sheet>
  );
}
