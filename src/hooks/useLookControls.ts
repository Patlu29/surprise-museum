import { useEffect, type RefObject } from 'react';
import { addOrbitDelta, addZoomDelta } from '@/state/inputState';

/** Degrees per pixel dragged (design spec 6.2). */
export const TOUCH_DEGREES_PER_PX = 0.3;
export const MOUSE_DEGREES_PER_PX = 0.25;
const WHEEL_NOTCH_METRES = 0.4;

/**
 * Drag-to-look and wheel zoom on the museum wrapper. Listeners sit on the wrapper (the canvas
 * bubbles to it) and on `window` while dragging, with no pointer capture, so the scene's own
 * picture picking (R3F onClick) keeps working. The joystick and HUD live outside the wrapper,
 * so a drag that starts on them never orbits. Only one pointer orbits at a time, so a second
 * finger can look around while the first holds the joystick.
 */
export function useLookControls(elementRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let activeId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let degreesPerPx = MOUSE_DEGREES_PER_PX;

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== activeId) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      // Look semantics: dragging right turns the view right; dragging down raises the camera.
      addOrbitDelta(dx * degreesPerPx, dy * degreesPerPx);
    };
    const end = (event: PointerEvent) => {
      if (event.pointerId !== activeId) return;
      activeId = null;
      element.classList.remove('is-dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    const onDown = (event: PointerEvent) => {
      if (activeId !== null) return;
      if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
      activeId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      degreesPerPx = event.pointerType === 'mouse' ? MOUSE_DEGREES_PER_PX : TOUCH_DEGREES_PER_PX;
      element.classList.add('is-dragging');
      element.focus({ preventScroll: true });
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      addZoomDelta(Math.sign(event.deltaY) * WHEEL_NOTCH_METRES);
    };
    const onContextMenu = (event: Event) => event.preventDefault();

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('contextmenu', onContextMenu);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('contextmenu', onContextMenu);
      element.classList.remove('is-dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [elementRef]);
}
