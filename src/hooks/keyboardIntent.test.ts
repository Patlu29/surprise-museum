import { describe, expect, it } from 'vitest';
import {
  accelerationFactor,
  computeKeyIntent,
  KEY_PITCH_RATE,
  KEY_YAW_RATE,
} from './keyboardIntent';

const keys = (...codes: string[]) => new Set(codes);

describe('computeKeyIntent', () => {
  it('maps W A S D and the arrow keys to camera-relative movement', () => {
    expect(computeKeyIntent(keys('KeyW'), false).move).toEqual({ x: 0, y: 1 });
    expect(computeKeyIntent(keys('KeyS'), false).move).toEqual({ x: 0, y: -1 });
    expect(computeKeyIntent(keys('KeyA'), false).move).toEqual({ x: -1, y: 0 });
    expect(computeKeyIntent(keys('KeyD'), false).move).toEqual({ x: 1, y: 0 });
    expect(computeKeyIntent(keys('ArrowUp'), false).move).toEqual({ x: 0, y: 1 });
    expect(computeKeyIntent(keys('ArrowLeft'), false).move).toEqual({ x: -1, y: 0 });
  });

  it('limits diagonal movement to unit length', () => {
    const { move } = computeKeyIntent(keys('KeyW', 'KeyD'), false);
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(1, 5);
  });

  it('cancels opposite keys', () => {
    expect(computeKeyIntent(keys('KeyW', 'KeyS'), false).move).toEqual({ x: 0, y: 0 });
  });

  it('turns the view with Q and E', () => {
    expect(computeKeyIntent(keys('KeyQ'), false).orbit.yaw).toBe(-KEY_YAW_RATE);
    expect(computeKeyIntent(keys('KeyE'), false).orbit.yaw).toBe(KEY_YAW_RATE);
  });

  it('turns and tilts with Shift and the arrow keys instead of walking', () => {
    const turn = computeKeyIntent(keys('ArrowRight'), true);
    expect(turn.move).toEqual({ x: 0, y: 0 });
    expect(turn.orbit.yaw).toBe(KEY_YAW_RATE);
    expect(computeKeyIntent(keys('ArrowDown'), true).orbit.pitch).toBe(KEY_PITCH_RATE);
    expect(computeKeyIntent(keys('ArrowUp'), true).orbit.pitch).toBe(-KEY_PITCH_RATE);
  });

  it('does nothing for unrelated keys', () => {
    expect(computeKeyIntent(keys('KeyX', 'Tab'), false)).toEqual({
      move: { x: 0, y: 0 },
      orbit: { yaw: 0, pitch: 0 },
    });
  });
});

describe('accelerationFactor', () => {
  it('ramps from 0 to 1 over 150 ms', () => {
    expect(accelerationFactor(0)).toBe(0);
    expect(accelerationFactor(75)).toBe(0.5);
    expect(accelerationFactor(150)).toBe(1);
    expect(accelerationFactor(1000)).toBe(1);
  });
});
