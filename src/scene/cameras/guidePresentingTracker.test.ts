import { describe, expect, it } from 'vitest';
import { GuidePresentingTracker } from './guidePresentingTracker';

describe('GuidePresentingTracker', () => {
  it('sends arrived false at the start and arrived true once, on arrival', () => {
    const t = new GuidePresentingTracker();
    expect(t.update(null, 'follow')).toEqual([]);
    expect(t.update('a', 'approach')).toEqual([{ photoId: 'a', arrived: false }]);
    expect(t.update('a', 'approach')).toEqual([]);
    expect(t.update('a', 'present')).toEqual([{ photoId: 'a', arrived: true }]);
    expect(t.update('a', 'present')).toEqual([]);
    expect(t.state).toEqual({ photoId: 'a', arrived: true });
  });

  it('sends both in order in one frame when the Guide is placed at once (reduced motion)', () => {
    const t = new GuidePresentingTracker();
    expect(t.update('a', 'present')).toEqual([
      { photoId: 'a', arrived: false },
      { photoId: 'a', arrived: true },
    ]);
  });

  it('does not send an arrival twice if she relocates and returns', () => {
    const t = new GuidePresentingTracker();
    t.update('a', 'approach');
    t.update('a', 'present');
    t.update('a', 'relocate');
    expect(t.update('a', 'present')).toEqual([]);
  });

  it('sends nothing further for a cancelled presentation', () => {
    const t = new GuidePresentingTracker();
    t.update('a', 'approach');
    expect(t.update(null, 'present')).toEqual([]);
    expect(t.state).toBeNull();
  });

  it('a replaced presentation starts again for the new photo only', () => {
    const t = new GuidePresentingTracker();
    t.update('a', 'approach');
    expect(t.update('b', 'approach')).toEqual([{ photoId: 'b', arrived: false }]);
    expect(t.update('b', 'present')).toEqual([{ photoId: 'b', arrived: true }]);
  });
});
