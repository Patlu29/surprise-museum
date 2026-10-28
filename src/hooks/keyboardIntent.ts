/**
 * Pure mapping from held keys to movement and turning (design spec 8.1). Uses `KeyboardEvent.code`
 * so it works on any keyboard layout. Shift with the arrow keys turns and tilts the view
 * instead of walking.
 */

export interface KeyIntent {
  move: { x: number; y: number };
  /** Degrees per second. */
  orbit: { yaw: number; pitch: number };
}

export const KEY_YAW_RATE = 90;
export const KEY_PITCH_RATE = 60;

export function computeKeyIntent(pressed: ReadonlySet<string>, shift: boolean): KeyIntent {
  const has = (code: string) => pressed.has(code);
  let moveX = 0;
  let moveY = 0;
  let yaw = 0;
  let pitch = 0;

  if (has('KeyW')) moveY += 1;
  if (has('KeyS')) moveY -= 1;
  if (has('KeyD')) moveX += 1;
  if (has('KeyA')) moveX -= 1;

  const arrowUp = has('ArrowUp');
  const arrowDown = has('ArrowDown');
  const arrowLeft = has('ArrowLeft');
  const arrowRight = has('ArrowRight');
  if (shift) {
    // Tilt up means looking up, which lowers the camera (pitch is camera elevation).
    if (arrowUp) pitch -= KEY_PITCH_RATE;
    if (arrowDown) pitch += KEY_PITCH_RATE;
    if (arrowLeft) yaw -= KEY_YAW_RATE;
    if (arrowRight) yaw += KEY_YAW_RATE;
  } else {
    if (arrowUp) moveY += 1;
    if (arrowDown) moveY -= 1;
    if (arrowRight) moveX += 1;
    if (arrowLeft) moveX -= 1;
  }

  if (has('KeyQ')) yaw -= KEY_YAW_RATE;
  if (has('KeyE')) yaw += KEY_YAW_RATE;

  const length = Math.hypot(moveX, moveY);
  if (length > 1) {
    moveX /= length;
    moveY /= length;
  }
  return {
    move: { x: moveX, y: moveY },
    orbit: {
      yaw: Math.max(-KEY_YAW_RATE, Math.min(KEY_YAW_RATE, yaw)),
      pitch: Math.max(-KEY_PITCH_RATE, Math.min(KEY_PITCH_RATE, pitch)),
    },
  };
}

/** Keys the canvas handles, so the browser's own use (scrolling, zoom) is suppressed. */
export const HANDLED_CODES: ReadonlySet<string> = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'KeyE',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

/** Linear acceleration over 150 ms from the first press (design spec 6.1). Release stops at once. */
export function accelerationFactor(heldMs: number): number {
  return Math.max(0, Math.min(1, heldMs / 150));
}
