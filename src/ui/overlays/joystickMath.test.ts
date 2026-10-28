import { describe, expect, it } from 'vitest';
import { JOYSTICK_MIN_SPEED, readJoystick } from './joystickMath';

const TRAVEL = 48;
const DEAD = 0.12;

describe('readJoystick', () => {
  it('gives no movement at the centre', () => {
    expect(readJoystick(0, 0, TRAVEL, DEAD).move).toEqual({ x: 0, y: 0 });
  });

  it('ignores the dead zone', () => {
    const reading = readJoystick(3, 0, TRAVEL, DEAD);
    expect(reading.move).toEqual({ x: 0, y: 0 });
    // The knob still follows the finger.
    expect(reading.knob.x).toBe(3);
  });

  it('walks forward when the knob is dragged up (screen up is forward)', () => {
    const { move } = readJoystick(0, -TRAVEL, TRAVEL, DEAD);
    expect(move.x).toBeCloseTo(0);
    expect(move.y).toBeCloseTo(1);
  });

  it('walks right when dragged right and back when dragged down', () => {
    expect(readJoystick(TRAVEL, 0, TRAVEL, DEAD).move.x).toBeCloseTo(1);
    expect(readJoystick(0, TRAVEL, TRAVEL, DEAD).move.y).toBeCloseTo(-1);
  });

  it('starts at 0.35 of walking speed just beyond the dead zone', () => {
    const { move } = readJoystick(TRAVEL * (DEAD + 0.001), 0, TRAVEL, DEAD);
    expect(move.x).toBeGreaterThanOrEqual(JOYSTICK_MIN_SPEED - 0.001);
    expect(move.x).toBeLessThan(JOYSTICK_MIN_SPEED + 0.02);
  });

  it('scales speed linearly with deflection', () => {
    const half = readJoystick(TRAVEL * 0.56, 0, TRAVEL, DEAD).move.x;
    expect(half).toBeCloseTo(JOYSTICK_MIN_SPEED + (1 - JOYSTICK_MIN_SPEED) * 0.5, 2);
  });

  it('limits the knob to the travel radius but keeps full speed beyond it', () => {
    const reading = readJoystick(200, 0, TRAVEL, DEAD);
    expect(reading.knob.x).toBe(TRAVEL);
    expect(reading.move.x).toBeCloseTo(1);
    const diagonal = readJoystick(200, 200, TRAVEL, DEAD);
    expect(Math.hypot(diagonal.knob.x, diagonal.knob.y)).toBeCloseTo(TRAVEL);
    expect(Math.hypot(diagonal.move.x, diagonal.move.y)).toBeCloseTo(1);
  });
});
