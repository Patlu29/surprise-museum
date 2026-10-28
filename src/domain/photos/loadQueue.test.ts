import { describe, expect, it } from 'vitest';
import { LoadError, PhotoLoadQueue, type LoadStatus } from './loadQueue';

interface Deferred {
  id: string;
  url: string;
  resolve: (v: string) => void;
  reject: (e: unknown) => void;
}

function harness(options: { backoff?: number[]; onUrlsExpired?: () => void } = {}) {
  const pending: Deferred[] = [];
  const started: string[] = [];
  const statuses = new Map<string, LoadStatus>();
  const loaded: string[] = [];
  const timers: Array<{ fn: () => void; ms: number; live: boolean }> = [];
  const queue = new PhotoLoadQueue<string>({
    load: (id, url) =>
      new Promise<string>((resolve, reject) => {
        started.push(id);
        pending.push({ id, url, resolve, reject });
      }),
    onStatus: (id, s) => statuses.set(id, s),
    onLoaded: (id) => loaded.push(id),
    onUrlsExpired: options.onUrlsExpired,
    backoffMs: options.backoff,
    setTimer: (fn, ms) => {
      const t = { fn, ms, live: true };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as { live: boolean }).live = false;
    },
  });
  const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  const finish = async (id: string) => {
    const d = pending.find((p) => p.id === id)!;
    pending.splice(pending.indexOf(d), 1);
    d.resolve(`tex-${id}`);
    await flush();
  };
  const fail = async (id: string, status?: number) => {
    const d = pending.find((p) => p.id === id)!;
    pending.splice(pending.indexOf(d), 1);
    d.reject(new LoadError('nope', status));
    await flush();
  };
  const fire = async () => {
    const t = timers.filter((x) => x.live);
    timers.length = 0;
    t.forEach((x) => x.fn());
    await flush();
  };
  return { queue, started, statuses, loaded, timers, finish, fail, fire, pending };
}

const photos = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, url: `u${i}` }));

describe('PhotoLoadQueue', () => {
  it('shows placeholders first and downloads at most 3 at a time', () => {
    const h = harness();
    h.queue.add(photos(8));
    expect(h.started).toHaveLength(3);
    expect(h.queue.activeCount).toBe(3);
    expect(h.statuses.get('p7')).toBe('placeholder');
    expect(h.statuses.get('p0')).toBe('loading');
  });

  it('loads the nearest photos first, and re-ranks when the Visitor moves', async () => {
    const h = harness();
    h.queue.rank(new Map(photos(8).map((p, i) => [p.id, 10 - i]))); // p7 is nearest
    h.queue.add(photos(8));
    expect(h.started).toEqual(['p7', 'p6', 'p5']);
    // The Visitor walks to the start: p0 becomes nearest.
    h.queue.rank(new Map(photos(8).map((p, i) => [p.id, i])));
    await h.finish('p7');
    expect(h.started[3]).toBe('p0');
    await h.finish('p6');
    expect(h.started[4]).toBe('p1');
  });

  it('keeps 3 in flight as downloads finish, and reports loaded', async () => {
    const h = harness();
    h.queue.add(photos(5));
    await h.finish('p0');
    expect(h.loaded).toEqual(['p0']);
    expect(h.queue.activeCount).toBe(3);
    expect(h.statuses.get('p0')).toBe('loaded');
  });

  it('retries three times with 1 s, 3 s and 9 s back-off, then fails', async () => {
    const h = harness();
    h.queue.add(photos(1));
    await h.fail('p0');
    expect(h.timers.map((t) => t.ms)).toEqual([1000]);
    await h.fire();
    await h.fail('p0');
    expect(h.timers.map((t) => t.ms)).toEqual([3000]);
    await h.fire();
    await h.fail('p0');
    expect(h.timers.map((t) => t.ms)).toEqual([9000]);
    await h.fire();
    await h.fail('p0');
    expect(h.statuses.get('p0')).toBe('failed');
    expect(h.timers).toHaveLength(0);
  });

  it('recovers when a retry succeeds', async () => {
    const h = harness();
    h.queue.add(photos(1));
    await h.fail('p0');
    await h.fire();
    await h.finish('p0');
    expect(h.statuses.get('p0')).toBe('loaded');
  });

  it('a manual retry restarts a failed photo with fresh attempts, ahead of the others', async () => {
    const h = harness({ backoff: [] });
    h.queue.add(photos(5));
    await h.fail('p0');
    expect(h.statuses.get('p0')).toBe('failed');
    for (const id of ['p1', 'p2']) await h.finish(id);
    h.queue.retry('p0');
    expect(h.started.at(-1)).toBe('p0');
    expect(h.statuses.get('p0')).toBe('loading');
  });

  it('asks for a URL refresh once on 403, then restarts waiting photos with the new URLs', async () => {
    let refreshes = 0;
    const h = harness({
      onUrlsExpired: () => {
        refreshes++;
      },
    });
    h.queue.add(photos(2));
    await h.fail('p0', 403);
    await h.fail('p1', 403);
    expect(refreshes).toBe(1);
    expect(h.statuses.get('p0')).toBe('loading'); // not shown as failed while waiting

    h.queue.updateUrls([
      { id: 'p0', url: 'fresh0' },
      { id: 'p1', url: 'fresh1' },
    ]);
    expect(h.pending.map((p) => p.url).sort()).toEqual(['fresh0', 'fresh1']);
  });

  it('does not stall: a failed photo frees its slot for the next', async () => {
    const h = harness({ backoff: [] });
    h.queue.add(photos(4));
    await h.fail('p0');
    expect(h.started).toContain('p3');
  });

  it('dispose aborts and ignores late results', async () => {
    const h = harness();
    h.queue.add(photos(2));
    h.queue.dispose();
    await h.finish('p0');
    expect(h.loaded).toHaveLength(0);
  });

  it('can be forced to fail, even after loading, and then retried (test hook)', async () => {
    const h = harness({ backoff: [] });
    h.queue.add(photos(1));
    await h.finish('p0');
    expect(h.statuses.get('p0')).toBe('loaded');
    h.queue.forceFail('p0');
    expect(h.statuses.get('p0')).toBe('failed');
    h.queue.retry('p0');
    expect(h.statuses.get('p0')).toBe('loading');
  });

  it('counts pending photos for the progress figure', async () => {
    const h = harness();
    h.queue.add(photos(4));
    expect(h.queue.pendingCount).toBe(4);
    await h.finish('p0');
    expect(h.queue.pendingCount).toBe(3);
  });
});
