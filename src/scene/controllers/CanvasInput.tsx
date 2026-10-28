import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import {
  addOrbitDelta,
  addZoomDelta,
  clearInput,
  setMoveSource,
  setOrbitRate,
} from '@/state/inputState';
import { useSessionStore } from '@/state/sessionStore';
import { attachCursor, setDragging } from './cursor';

/**
 * Keyboard, drag-to-look and wheel input for the canvas, written into the shared transient
 * `inputState`. The joystick and the on-screen arrow buttons write the same state from the UI
 * (sources 'joystick' and 'arrows'), so every input path ends up in one place.
 *
 * Keyboard shortcuts are active only while the canvas wrapper has focus (WCAG 2.1.4), and Tab is
 * never captured. Design spec 6.1, 6.2 and 8.1:
 *   W A S D, arrows   walk (camera-relative)
 *   Q E, Shift+Left/Right   turn the view (90 deg/s); Shift+Up/Down tilt it (60 deg/s)
 *   + and -           camera closer, further (0.4 m)
 *   R                 reset view
 *   Enter, Space      dismiss the caption card (only when it is open and the canvas has focus)
 * Drag: 0.3 degrees per pixel for touch, 0.25 for mouse. Only the first pointer orbits, so a
 * second finger never fights the joystick.
 */
const KEY_YAW_RATE = 90;
const KEY_PITCH_RATE = 60;
const TOUCH_DEG_PER_PX = 0.3;
const MOUSE_DEG_PER_PX = 0.25;
const WHEEL_NOTCH_PX = 100;
const ZOOM_STEP = 0.4;

export function CanvasInput() {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    const wrapper = canvas.closest<HTMLElement>('.scene-root') ?? canvas.parentElement;
    attachCursor(canvas, true);
    canvas.style.touchAction = 'none';

    // ---- Keyboard -------------------------------------------------------------------------
    const down = new Set<string>();
    const hasFocus = (): boolean => {
      const active = document.activeElement;
      if (!wrapper) return false;
      if (active && wrapper.contains(active)) return true;
      // Without a focusable wrapper (development, tests) the page body counts as the canvas.
      return !wrapper.hasAttribute('tabindex') && (!active || active === document.body);
    };
    const refresh = (): void => {
      const shift = down.has('shift');
      let mx = 0;
      let my = 0;
      let yaw = 0;
      let pitch = 0;
      if (down.has('w') || (down.has('arrowup') && !shift)) my += 1;
      if (down.has('s') || (down.has('arrowdown') && !shift)) my -= 1;
      if (down.has('a') || (down.has('arrowleft') && !shift)) mx -= 1;
      if (down.has('d') || (down.has('arrowright') && !shift)) mx += 1;
      if (down.has('e') || (down.has('arrowright') && shift)) yaw += KEY_YAW_RATE;
      if (down.has('q') || (down.has('arrowleft') && shift)) yaw -= KEY_YAW_RATE;
      if (down.has('arrowup') && shift) pitch += KEY_PITCH_RATE;
      if (down.has('arrowdown') && shift) pitch -= KEY_PITCH_RATE;
      setMoveSource('keyboard', mx, my);
      setOrbitRate('keyboard', yaw, pitch);
    };
    const normalise = (e: KeyboardEvent): string =>
      e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
    const MOVE_KEYS = new Set([
      'w',
      'a',
      's',
      'd',
      'q',
      'e',
      'shift',
      'arrowup',
      'arrowdown',
      'arrowleft',
      'arrowright',
    ]);

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || !hasFocus()) return;
      const key = normalise(e);
      if (MOVE_KEYS.has(key)) {
        if (key !== 'shift') e.preventDefault();
        down.add(key);
        refresh();
        return;
      }
      if (key === '+' || key === '=') {
        e.preventDefault();
        addZoomDelta(-ZOOM_STEP);
      } else if (key === '-' || key === '_') {
        e.preventDefault();
        addZoomDelta(ZOOM_STEP);
      } else if (key === 'r' && !e.repeat) {
        useSessionStore.getState().resetView();
      } else if ((key === 'enter' || key === ' ') && !e.repeat) {
        // Dismiss only when the card is open and the canvas itself has focus; a focused button
        // inside the wrapper keeps its normal activation.
        const target = e.target;
        const onCanvas = target === wrapper || target === canvas || target === document.body;
        if (onCanvas && useSessionStore.getState().presentation.kind !== 'none') {
          e.preventDefault();
          useSessionStore.getState().dismissPresentation();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      const key = normalise(e);
      if (down.delete(key)) refresh();
    };
    const stopAll = (): void => {
      down.clear();
      clearInput();
    };
    const onVisibility = (): void => {
      if (document.hidden) stopAll();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', stopAll);
    window.addEventListener('pagehide', stopAll);
    document.addEventListener('visibilitychange', onVisibility);
    wrapper?.addEventListener('blur', stopAll, true);

    // ---- Drag to look ---------------------------------------------------------------------
    let activePointer: number | null = null;
    let lastX = 0;
    let lastY = 0;
    const onPointerDown = (e: PointerEvent): void => {
      if (activePointer !== null) return;
      if (e.pointerType === 'mouse' && e.button > 2) return;
      activePointer = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
      if (e.pointerType === 'mouse') setDragging(true);
      // Take focus so keyboard control works after a click, as the wrapper allows.
      if (wrapper?.hasAttribute('tabindex')) wrapper.focus({ preventScroll: true });
    };
    const onPointerMove = (e: PointerEvent): void => {
      if (e.pointerId !== activePointer) return;
      const k = e.pointerType === 'mouse' ? MOUSE_DEG_PER_PX : TOUCH_DEG_PER_PX;
      addOrbitDelta((e.clientX - lastX) * k, (e.clientY - lastY) * k);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerEnd = (e: PointerEvent): void => {
      if (e.pointerId !== activePointer) return;
      activePointer = null;
      setDragging(false);
      if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    const onContextMenu = (e: Event): void => e.preventDefault();
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerEnd);
    canvas.addEventListener('pointercancel', onPointerEnd);
    canvas.addEventListener('contextmenu', onContextMenu);

    // ---- Wheel: camera distance, desktop only ----------------------------------------------
    let wheelAcc = 0;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      if (window.matchMedia?.('(pointer: coarse)').matches) return;
      wheelAcc += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      while (Math.abs(wheelAcc) >= WHEEL_NOTCH_PX) {
        addZoomDelta(Math.sign(wheelAcc) * ZOOM_STEP);
        wheelAcc -= Math.sign(wheelAcc) * WHEEL_NOTCH_PX;
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', stopAll);
      window.removeEventListener('pagehide', stopAll);
      document.removeEventListener('visibilitychange', onVisibility);
      wrapper?.removeEventListener('blur', stopAll, true);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('wheel', onWheel);
      attachCursor(null);
      stopAll();
    };
  }, [gl]);

  return null;
}
