import { useEffect, useRef, type RefObject } from 'react';
import { addZoomDelta, setMoveSource, setOrbitRate } from '@/state/inputState';
import { accelerationFactor, computeKeyIntent, HANDLED_CODES } from './keyboardIntent';

export interface CanvasKeyHandlers {
  onHelp: () => void;
  onPictures: () => void;
  onHint: () => void;
  onResetView: () => void;
  /** Escape: close the topmost panel, card or viewer. */
  onEscape: () => void;
  /** Enter or Space on the canvas: dismiss the caption card if one is open. Returns true if it did. */
  onActivate: () => boolean;
}

const ZOOM_NOTCH_METRES = 0.4;

/**
 * Keyboard controls, active only while the canvas wrapper has focus (WCAG 2.1.4). Tab always
 * leaves the canvas. Writes movement and turning to `inputState` for the scene.
 */
export function useCanvasKeyboard(
  elementRef: RefObject<HTMLElement | null>,
  handlers: CanvasKeyHandlers,
): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const pressed = new Set<string>();
    let shift = false;
    let rafId = 0;
    let moveStart = 0;

    const apply = (now: number) => {
      const intent = computeKeyIntent(pressed, shift);
      const moving = intent.move.x !== 0 || intent.move.y !== 0;
      if (!moving) moveStart = 0;
      else if (moveStart === 0) moveStart = now;
      const factor = moving ? accelerationFactor(now - moveStart) : 0;
      setMoveSource('keyboard', intent.move.x * factor, intent.move.y * factor);
      setOrbitRate('keyboard', intent.orbit.yaw, intent.orbit.pitch);
      return moving && factor < 1;
    };

    const loop = (now: number) => {
      rafId = apply(now) ? requestAnimationFrame(loop) : 0;
    };
    const refresh = () => {
      const needsMore = apply(performance.now());
      if (needsMore && rafId === 0) rafId = requestAnimationFrame(loop);
    };
    /**
     * Releases the keyboard's own movement only. The joystick and arrow buttons are separate
     * sources: pressing one of them blurs the canvas, and that must not cancel the press.
     */
    const stopKeyboard = () => {
      pressed.clear();
      shift = false;
      moveStart = 0;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      setMoveSource('keyboard', 0, 0);
      setOrbitRate('keyboard', 0, 0);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const { code } = event;
      const h = handlersRef.current;
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        shift = true;
        refresh();
        return;
      }
      if (HANDLED_CODES.has(code)) {
        event.preventDefault();
        shift = event.shiftKey;
        pressed.add(code);
        refresh();
        return;
      }
      switch (code) {
        case 'Equal':
        case 'NumpadAdd':
          event.preventDefault();
          addZoomDelta(-ZOOM_NOTCH_METRES);
          break;
        case 'Minus':
        case 'NumpadSubtract':
          event.preventDefault();
          addZoomDelta(ZOOM_NOTCH_METRES);
          break;
        case 'KeyR':
          h.onResetView();
          break;
        case 'KeyH':
          h.onHelp();
          break;
        case 'KeyP':
          h.onPictures();
          break;
        case 'KeyN':
          h.onHint();
          break;
        case 'Escape':
          h.onEscape();
          break;
        case 'Enter':
        case 'Space':
          if (h.onActivate()) event.preventDefault();
          break;
        default:
          break;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') shift = false;
      else pressed.delete(event.code);
      refresh();
    };
    const onVisibility = () => {
      if (document.hidden) stopKeyboard();
    };

    element.addEventListener('keydown', onKeyDown);
    element.addEventListener('keyup', onKeyUp);
    element.addEventListener('blur', stopKeyboard);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      element.removeEventListener('keydown', onKeyDown);
      element.removeEventListener('keyup', onKeyUp);
      element.removeEventListener('blur', stopKeyboard);
      document.removeEventListener('visibilitychange', onVisibility);
      stopKeyboard();
    };
  }, [elementRef]);
}
