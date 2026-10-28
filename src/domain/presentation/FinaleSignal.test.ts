import { describe, expect, it } from 'vitest';
import { generateLayout } from '../layout/generateLayout';
import type { Vec2 } from '../math/vec2';
import { FinaleSignal } from './FinaleSignal';
import { PresentationDirector } from './PresentationDirector';

const layout = generateLayout(
  Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, width: 1000, height: 800 })),
);
const c = layout.finale.center;
const at = (dx: number): Vec2 => ({ x: c.x + dx, z: c.z });

/** Step the director and the signal together, collecting the edges the UI would see. */
function setup() {
  const director = new PresentationDirector(layout);
  const signal = new FinaleSignal();
  const edges: boolean[] = [];
  const step = (pos: Vec2) => {
    const edge = signal.update(director.update(1 / 30, pos));
    if (edge !== null) edges.push(edge);
  };
  return { director, signal, edges, step };
}

describe('FinaleSignal (finaleReached)', () => {
  it('is true on entering the podium zone and false on leaving, once each', () => {
    const { edges, step } = setup();
    for (let i = 0; i < 5; i++) step(at(5)); // far away
    expect(edges).toEqual([]);
    for (let i = 0; i < 30; i++) step(at(1)); // on the podium, many frames
    expect(edges).toEqual([true]);
    for (let i = 0; i < 30; i++) step(at(2.5)); // still inside trigger + 1 m: stays on
    expect(edges).toEqual([true]);
    for (let i = 0; i < 30; i++) step(at(3.2)); // left
    expect(edges).toEqual([true, false]);
  });

  it('does not come back after Keep exploring until she has left and entered again', () => {
    const { director, edges, step } = setup();
    step(at(0.5));
    expect(edges).toEqual([true]);
    director.dismiss(); // Keep exploring: the UI clears finaleReached itself
    for (let i = 0; i < 60; i++) step(at(0.5)); // still standing on the podium
    // The signal reports the intent ending, but never goes back to true while she stays.
    expect(edges).toEqual([true, false]);
    for (let i = 0; i < 30; i++) step(at(2.5)); // inside the exit radius: still suppressed
    expect(edges).toEqual([true, false]);
    for (let i = 0; i < 30; i++) step(at(3.2)); // left the zone
    step(at(0.5)); // entered again
    expect(edges).toEqual([true, false, true]);
  });

  it('reports a Visitor placed on the podium by a jump as entering', () => {
    const { director, signal, edges, step } = setup();
    step(at(0.5));
    expect(edges).toEqual([true]);
    // Jump to the finale while already inside: the director and signal are reset together.
    director.reset();
    signal.reset();
    step(at(0.5));
    expect(edges).toEqual([true, true]);
  });

  it('goes false on replay (Visitor sent to the entrance)', () => {
    const { director, signal, edges, step } = setup();
    step(at(0.5));
    director.reset();
    signal.reset();
    step({ ...layout.spawn.visitor.position });
    expect(edges).toEqual([true]); // reset leaves it false; the UI has already cleared its flag
    expect(signal.update({ kind: 'none' })).toBeNull();
  });
});
