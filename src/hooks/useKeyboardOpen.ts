import { useEffect, useState } from 'react';

/** The visual viewport is under this share of the window while an on-screen keyboard is up. */
const KEYBOARD_RATIO = 0.75;

function isTextField(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'].includes(
      element.type,
    );
  }
  return false;
}

/**
 * True while a text field has focus and the visual viewport is under 75% of the window (design
 * spec 12.4.4). Browsers that honour `interactive-widget=resizes-content` shrink the window too, so
 * this stays false for them; iOS Safari does not, and uses this to stop the sticky bar covering the field.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    const check = () => {
      const shrunk = Boolean(viewport) && viewport!.height < window.innerHeight * KEYBOARD_RATIO;
      setOpen(shrunk && isTextField(document.activeElement));
    };
    viewport?.addEventListener('resize', check);
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    return () => {
      viewport?.removeEventListener('resize', check);
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
    };
  }, []);
  return open;
}
