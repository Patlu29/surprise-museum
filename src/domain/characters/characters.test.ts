import { describe, expect, it } from 'vitest';
import { generateLayout } from '../layout/generateLayout';
import type { CharacterRole, MoveIntent, Presentation, WorldContext } from './characterState';
import { CharacterRegistryImpl } from './CharacterRegistryImpl';
import { LocalVisitorController } from './LocalVisitorController';
import { ScriptedCharacterSource } from './ScriptedCharacterSource';

const layout = generateLayout(
  Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, width: 1000, height: 800 })),
);
const camera = { position: { x: 0, y: 2.2, z: 2 }, forward: { x: 0, y: 0, z: -1 } };
const baseWorld = { time: 0, camera, reducedMotion: false };

function worldFor(visitor: LocalVisitorController): WorldContext {
  return {
    ...baseWorld,
    characters: new Map([['visitor', visitor.read()]]),
  } as WorldContext;
}

describe('LocalVisitorController', () => {
  it('walks camera-relative: forward goes away from the camera', () => {
    const intent: MoveIntent = { x: 0, y: 1 };
    const v = new LocalVisitorController({ layout, readIntent: () => intent });
    const start = { ...v.read().position };
    for (let i = 0; i < 30; i++) v.tick(1 / 30, worldFor(v));
    expect(v.read().position.z).toBeLessThan(start.z - 1); // camera looks down -Z
    expect(Math.abs(v.read().position.x - start.x)).toBeLessThan(1e-6);
    expect(v.read().locomotion).toBe('walk');
  });

  it('turns the view-relative axes with the camera', () => {
    const intent: MoveIntent = { x: 1, y: 0 }; // right of a camera looking down -Z is +X
    const v = new LocalVisitorController({ layout, readIntent: () => intent });
    const x0 = v.read().position.x;
    for (let i = 0; i < 30; i++) v.tick(1 / 30, worldFor(v));
    expect(v.read().position.x).toBeGreaterThan(x0 + 0.8);
  });

  it('caps speed at 1.6 m/s, eases up over about 150 ms, and stops at once', () => {
    const intent: MoveIntent = { x: 0, y: 1 };
    const v = new LocalVisitorController({ layout, readIntent: () => intent });
    v.tick(1 / 30, worldFor(v));
    expect(v.read().speed).toBeLessThan(1.6); // still easing in
    for (let i = 0; i < 60; i++) v.tick(1 / 30, worldFor(v));
    expect(v.read().speed).toBeLessThanOrEqual(1.6 + 1e-6);
    expect(v.read().speed).toBeGreaterThan(1.5);
    intent.y = 0;
    v.tick(1 / 30, worldFor(v));
    expect(v.read().speed).toBe(0);
    expect(v.read().locomotion).toBe('idle');
  });

  it('scales speed with joystick deflection', () => {
    const intent: MoveIntent = { x: 0, y: 0.5 };
    const v = new LocalVisitorController({ layout, readIntent: () => intent });
    for (let i = 0; i < 60; i++) v.tick(1 / 30, worldFor(v));
    expect(v.read().speed).toBeCloseTo(0.8, 1);
  });

  it('cannot walk through the back wall, and walks only while moving', () => {
    const intent: MoveIntent = { x: 0, y: -1 }; // towards the camera and the back wall
    const v = new LocalVisitorController({ layout, readIntent: () => intent });
    for (let i = 0; i < 300; i++) v.tick(1 / 30, worldFor(v));
    expect(v.read().position.z).toBeLessThanOrEqual(-0.1 - 0.3 + 1e-6);
    expect(v.read().locomotion).toBe('idle');
    expect(v.read().speed).toBe(0);
  });

  it('teleport moves instantly and bumps teleportSeq', () => {
    const v = new LocalVisitorController({ layout, readIntent: () => ({ x: 0, y: 0 }) });
    const seq = v.read().teleportSeq;
    v.teleport({ x: -2.4, y: 0, z: -9 }, 1);
    expect(v.read().position).toEqual({ x: -2.4, y: 0, z: -9 });
    expect(v.read().teleportSeq).toBe(seq + 1);
  });
});

describe('CharacterRegistryImpl', () => {
  it('ticks the Visitor first so the Guide sees the latest Visitor state', () => {
    const order: CharacterRole[] = [];
    const registry = new CharacterRegistryImpl();
    const visitor = new ScriptedCharacterSource();
    const guide = new ScriptedCharacterSource();
    const tickV = visitor.tick.bind(visitor);
    const tickG = guide.tick.bind(guide);
    visitor.tick = (dt, w) => {
      order.push('visitor');
      visitor.set({ position: { x: 5, y: 0, z: 5 } });
      tickV(dt, w);
    };
    let seenByGuide = 0;
    guide.tick = (dt, w) => {
      order.push('guide');
      seenByGuide = w.characters.get('visitor')?.position.x ?? -1;
      tickG(dt, w);
    };
    registry.setSource('visitor', visitor);
    registry.setSource('guide', guide);
    registry.tickAll(1 / 30, baseWorld);
    expect(order).toEqual(['visitor', 'guide']);
    expect(seenByGuide).toBe(5);
  });

  it('reports each presentation change once', () => {
    const registry = new CharacterRegistryImpl();
    const guide = new ScriptedCharacterSource();
    registry.setSource('visitor', new ScriptedCharacterSource());
    registry.setSource('guide', guide);
    const seen: Array<[CharacterRole, Presentation]> = [];
    const off = registry.onPresentationChange((r, p) => seen.push([r, p]));

    registry.tickAll(0.03, baseWorld);
    expect(seen).toHaveLength(0);
    guide.set({ presentation: { kind: 'photo', photoId: 'a' } });
    registry.tickAll(0.03, baseWorld);
    registry.tickAll(0.03, baseWorld);
    expect(seen).toEqual([['guide', { kind: 'photo', photoId: 'a' }]]);
    guide.set({ presentation: { kind: 'photo', photoId: 'b' } });
    registry.tickAll(0.03, baseWorld);
    guide.set({ presentation: { kind: 'none' } });
    registry.tickAll(0.03, baseWorld);
    expect(seen.map(([, p]) => p.kind)).toEqual(['photo', 'photo', 'none']);
    off();
    guide.set({ presentation: { kind: 'finale' } });
    registry.tickAll(0.03, baseWorld);
    expect(seen).toHaveLength(3);
  });

  it('swaps a source without anyone else changing (NFR-25), disposing the old one', () => {
    const registry = new CharacterRegistryImpl();
    let disposed = false;
    const local = new LocalVisitorController({ layout, readIntent: () => ({ x: 0, y: 0 }) });
    (local as { dispose?: () => void }).dispose = () => {
      disposed = true;
    };
    registry.setSource('visitor', local);
    const scripted = new ScriptedCharacterSource({ position: { x: 1, y: 0, z: -3 } });
    registry.setSource('visitor', scripted);
    expect(disposed).toBe(true);
    expect(registry.getSource('visitor').kind).toBe('scripted');
    expect(registry.getSource('visitor').read().position.x).toBe(1);
  });

  it('throws a helpful error for a missing source', () => {
    expect(() => new CharacterRegistryImpl().getSource('guide')).toThrow(/guide/);
  });
});

describe('ScriptedCharacterSource', () => {
  it('interpolates keyframes and steps discrete fields', () => {
    const s = new ScriptedCharacterSource();
    s.play([
      { t: 0, position: { x: 0, y: 0, z: 0 }, heading: 0, locomotion: 'walk' },
      { t: 2, position: { x: 4, y: 0, z: -2 }, heading: 1, locomotion: 'idle' },
    ]);
    for (let i = 0; i < 30; i++) s.tick(1 / 30, { ...baseWorld, characters: new Map() });
    expect(s.read().position.x).toBeCloseTo(2, 1);
    expect(s.read().position.z).toBeCloseTo(-1, 1);
    expect(s.read().heading).toBeCloseTo(0.5, 1);
    expect(s.read().locomotion).toBe('walk');
    expect(s.read().speed).toBeGreaterThan(0);
  });

  it('teleports and bumps teleportSeq', () => {
    const s = new ScriptedCharacterSource();
    s.teleport({ x: 3, y: 0, z: 3 }, 2);
    expect(s.read().position).toEqual({ x: 3, y: 0, z: 3 });
    expect(s.read().teleportSeq).toBe(1);
  });
});
