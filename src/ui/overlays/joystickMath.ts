/**
 * Virtual joystick mapping (design spec 5.9). The knob offset is limited to `travel`. Inside the
 * dead zone there is no movement. Beyond it, magnitude maps linearly to 0.35 to 1.0 of walking
 * speed. Screen up is forward (+y); direction is camera-relative.
 */
export const JOYSTICK_MIN_SPEED = 0.35;

export interface JoystickReading {
  /** Knob offset in pixels, limited to the travel radius. */
  knob: { x: number; y: number };
  /** Camera-relative movement intent, each axis -1..1. */
  move: { x: number; y: number };
}

export function readJoystick(
  dx: number,
  dy: number,
  travel: number,
  deadZone: number,
): JoystickReading {
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || travel <= 0) return { knob: { x: 0, y: 0 }, move: { x: 0, y: 0 } };
  const limited = Math.min(distance, travel);
  const unitX = dx / distance;
  const unitY = dy / distance;
  const knob = { x: unitX * limited, y: unitY * limited };
  const fraction = limited / travel;
  if (fraction < deadZone) return { knob, move: { x: 0, y: 0 } };
  const scaled = (fraction - deadZone) / (1 - deadZone);
  const magnitude = JOYSTICK_MIN_SPEED + (1 - JOYSTICK_MIN_SPEED) * scaled;
  return { knob, move: { x: unitX * magnitude, y: -unitY * magnitude } };
}
