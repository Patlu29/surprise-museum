import type { MoveIntent } from '@/domain/characters/characterState';

/**
 * Transient input state (architecture 6.9). A plain mutable object, NOT a Zustand store, so
 * per-frame input never re-renders anything. The UI writes it (joystick, keyboard, arrow
 * buttons, drag-to-look, wheel); `LocalVisitorController` and the camera read it every frame.
 *
 * Conventions (the scene may flip a sign if its camera maths prefers):
 *  - `move`: camera-relative, each axis -1..1, length at most 1. y = +1 walks away from the
 *    camera (forward), x = +1 walks to the camera's right. Already merged from every source.
 *  - `orbitRate`: degrees per second while a key or button is held. yaw > 0 turns the view to
 *    the right; pitch > 0 raises the camera (looks more downward). Integrate with dt.
 *  - `orbitDelta`: degrees accumulated from drags since the last `consumeOrbitDelta()`.
 *    Same signs as `orbitRate`. Drag right gives yaw > 0; drag down gives pitch > 0.
 *  - `zoomDelta`: metres of boom change accumulated since the last `consumeZoomDelta()`;
 *    positive moves the camera further away. 0.4 m per wheel notch (design spec 6.3).
 */

export type MoveSource = 'keyboard' | 'joystick' | 'arrows';
export type OrbitSource = 'keyboard' | 'buttons';

export interface InputState {
  readonly move: MoveIntent;
  readonly orbitRate: { yaw: number; pitch: number };
  readonly orbitDelta: { yaw: number; pitch: number };
  zoomDelta: number;
}

export const inputState: InputState = {
  move: { x: 0, y: 0 },
  orbitRate: { yaw: 0, pitch: 0 },
  orbitDelta: { yaw: 0, pitch: 0 },
  zoomDelta: 0,
};

const moveSources: Record<MoveSource, MoveIntent> = {
  keyboard: { x: 0, y: 0 },
  joystick: { x: 0, y: 0 },
  arrows: { x: 0, y: 0 },
};
const orbitSources: Record<OrbitSource, { yaw: number; pitch: number }> = {
  keyboard: { yaw: 0, pitch: 0 },
  buttons: { yaw: 0, pitch: 0 },
};

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/** Sets one source's movement and recomputes the merged `move` (length limited to 1). */
export function setMoveSource(source: MoveSource, x: number, y: number): void {
  moveSources[source].x = clampUnit(x);
  moveSources[source].y = clampUnit(y);
  let sumX = 0;
  let sumY = 0;
  for (const value of Object.values(moveSources)) {
    sumX += value.x;
    sumY += value.y;
  }
  const length = Math.hypot(sumX, sumY);
  const scale = length > 1 ? 1 / length : 1;
  inputState.move.x = sumX * scale;
  inputState.move.y = sumY * scale;
}

/** Sets one source's continuous turn rate in degrees per second and recomputes the merged rate. */
export function setOrbitRate(source: OrbitSource, yaw: number, pitch: number): void {
  orbitSources[source].yaw = yaw;
  orbitSources[source].pitch = pitch;
  inputState.orbitRate.yaw = orbitSources.keyboard.yaw + orbitSources.buttons.yaw;
  inputState.orbitRate.pitch = orbitSources.keyboard.pitch + orbitSources.buttons.pitch;
}

export function addOrbitDelta(yawDegrees: number, pitchDegrees: number): void {
  inputState.orbitDelta.yaw += yawDegrees;
  inputState.orbitDelta.pitch += pitchDegrees;
}

/** Returns the accumulated drag rotation and resets it. Call once per frame. */
export function consumeOrbitDelta(): { yaw: number; pitch: number } {
  const out = { yaw: inputState.orbitDelta.yaw, pitch: inputState.orbitDelta.pitch };
  inputState.orbitDelta.yaw = 0;
  inputState.orbitDelta.pitch = 0;
  return out;
}

export function addZoomDelta(metres: number): void {
  inputState.zoomDelta += metres;
}

export function consumeZoomDelta(): number {
  const out = inputState.zoomDelta;
  inputState.zoomDelta = 0;
  return out;
}

/** Stops all movement and turning at once (blur, hidden tab, viewer opened, unmount). */
export function clearInput(): void {
  for (const value of Object.values(moveSources)) {
    value.x = 0;
    value.y = 0;
  }
  for (const value of Object.values(orbitSources)) {
    value.yaw = 0;
    value.pitch = 0;
  }
  inputState.move.x = 0;
  inputState.move.y = 0;
  inputState.orbitRate.yaw = 0;
  inputState.orbitRate.pitch = 0;
  inputState.orbitDelta.yaw = 0;
  inputState.orbitDelta.pitch = 0;
  inputState.zoomDelta = 0;
}
