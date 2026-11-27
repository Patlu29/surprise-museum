/**
 * Purge health (ADR 0023, NFR-33). A pure function, so the 3-hour rule is tested with a fixed
 * clock and no database. No imports: the inputs are plain strings.
 */

/** Q-40 (a): three hours. Exactly this age is still healthy. */
export const PURGE_HEALTH_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export interface PurgeHealthInputs {
  /** ISO 8601. Postgres's now() when the inputs were read. */
  checkedAt: string;
  /** Null if the purge has never recorded a success. */
  lastSuccessAt: string | null;
  /** Oldest entry in the storage-delete queue; null if the queue is empty. */
  oldestQueuedAt: string | null;
  /** Oldest museum or draft already past its end but still in the database; null if none. */
  oldestExpiredAt: string | null;
}

/**
 * Healthy only when the purge succeeded within `maxAgeMs`, nothing has waited in the queue longer
 * than that, and nothing expired longer ago than that is still stored. A value that does not
 * parse (including `checkedAt`) is unhealthy: unknown never counts as fine.
 */
export function isPurgeHealthy(
  inputs: PurgeHealthInputs,
  maxAgeMs: number = PURGE_HEALTH_MAX_AGE_MS,
): boolean {
  const checked = Date.parse(inputs.checkedAt);
  if (Number.isNaN(checked)) return false;

  // Age of a timestamp at the moment of the check, or NaN when it cannot be read.
  const ageOf = (value: string): number => checked - Date.parse(value);

  if (inputs.lastSuccessAt === null) return false;
  const sinceSuccess = ageOf(inputs.lastSuccessAt);
  if (Number.isNaN(sinceSuccess) || sinceSuccess > maxAgeMs) return false;

  for (const value of [inputs.oldestQueuedAt, inputs.oldestExpiredAt]) {
    if (value === null) continue;
    const age = ageOf(value);
    if (Number.isNaN(age) || age > maxAgeMs) return false;
  }
  return true;
}
