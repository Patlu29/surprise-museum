import { assertEquals } from '@std/assert';
import {
  isPurgeHealthy,
  PURGE_HEALTH_MAX_AGE_MS,
  type PurgeHealthInputs,
} from '../_shared/purgeHealth.ts';

// A fixed clock: every age is measured against this checkedAt, never the real time.
const CHECKED = Date.parse('2026-11-27T20:37:00.000Z');
const MINUTE = 60_000;
const ago = (ms: number): string => new Date(CHECKED - ms).toISOString();

function inputs(overrides: Partial<PurgeHealthInputs> = {}): PurgeHealthInputs {
  return {
    checkedAt: new Date(CHECKED).toISOString(),
    lastSuccessAt: ago(10 * MINUTE),
    oldestQueuedAt: null,
    oldestExpiredAt: null,
    ...overrides,
  };
}

Deno.test('the limit is three hours', () => {
  assertEquals(PURGE_HEALTH_MAX_AGE_MS, 3 * 60 * MINUTE);
});

Deno.test('a recent purge, an empty queue and nothing left behind is healthy', () => {
  assertEquals(isPurgeHealthy(inputs()), true);
});

Deno.test('last success: 2 h 59 min healthy, exactly 3 h healthy, 3 h 1 min unhealthy', () => {
  assertEquals(isPurgeHealthy(inputs({ lastSuccessAt: ago((3 * 60 - 1) * MINUTE) })), true);
  assertEquals(isPurgeHealthy(inputs({ lastSuccessAt: ago(3 * 60 * MINUTE) })), true);
  assertEquals(isPurgeHealthy(inputs({ lastSuccessAt: ago(3 * 60 * MINUTE + 1) })), false);
  assertEquals(isPurgeHealthy(inputs({ lastSuccessAt: ago((3 * 60 + 1) * MINUTE) })), false);
});

Deno.test('no purge ever recorded is unhealthy', () => {
  assertEquals(isPurgeHealthy(inputs({ lastSuccessAt: null })), false);
});

Deno.test(
  'oldest queued delete: 2 h 59 min healthy, exactly 3 h healthy, 3 h 1 min unhealthy',
  () => {
    assertEquals(isPurgeHealthy(inputs({ oldestQueuedAt: ago((3 * 60 - 1) * MINUTE) })), true);
    assertEquals(isPurgeHealthy(inputs({ oldestQueuedAt: ago(3 * 60 * MINUTE) })), true);
    assertEquals(isPurgeHealthy(inputs({ oldestQueuedAt: ago((3 * 60 + 1) * MINUTE) })), false);
  },
);

Deno.test(
  'oldest expired museum: 2 h 59 min healthy, exactly 3 h healthy, 3 h 1 min unhealthy',
  () => {
    assertEquals(isPurgeHealthy(inputs({ oldestExpiredAt: ago((3 * 60 - 1) * MINUTE) })), true);
    assertEquals(isPurgeHealthy(inputs({ oldestExpiredAt: ago(3 * 60 * MINUTE) })), true);
    assertEquals(isPurgeHealthy(inputs({ oldestExpiredAt: ago((3 * 60 + 1) * MINUTE) })), false);
  },
);

Deno.test('each condition alone makes it unhealthy while the other two are fine', () => {
  const old = ago(4 * 60 * MINUTE);
  assertEquals(isPurgeHealthy(inputs({ lastSuccessAt: old })), false);
  assertEquals(isPurgeHealthy(inputs({ oldestQueuedAt: old })), false);
  assertEquals(isPurgeHealthy(inputs({ oldestExpiredAt: old })), false);
});

Deno.test('a timestamp that does not parse is unhealthy, including checkedAt', () => {
  for (const bad of ['', 'not a date', 'null', '2026-13-45T99:99:99Z']) {
    assertEquals(isPurgeHealthy(inputs({ lastSuccessAt: bad })), false, `lastSuccessAt ${bad}`);
    assertEquals(isPurgeHealthy(inputs({ oldestQueuedAt: bad })), false, `oldestQueuedAt ${bad}`);
    assertEquals(isPurgeHealthy(inputs({ oldestExpiredAt: bad })), false, `oldestExpiredAt ${bad}`);
    assertEquals(isPurgeHealthy(inputs({ checkedAt: bad })), false, `checkedAt ${bad}`);
  }
});

Deno.test('Postgres timestamps with microseconds and an offset are read correctly', () => {
  const checkedAt = '2026-11-27T20:37:04.512361+00:00';
  assertEquals(
    isPurgeHealthy(inputs({ checkedAt, lastSuccessAt: '2026-11-27T17:37:04.512361+00:00' })),
    true,
  );
  assertEquals(
    isPurgeHealthy(inputs({ checkedAt, lastSuccessAt: '2026-11-27T17:36:04.512361+00:00' })),
    false,
  );
});

Deno.test('a custom limit is honoured', () => {
  assertEquals(isPurgeHealthy(inputs({ lastSuccessAt: ago(61 * MINUTE) }), 60 * MINUTE), false);
  assertEquals(isPurgeHealthy(inputs({ lastSuccessAt: ago(60 * MINUTE) }), 60 * MINUTE), true);
});
