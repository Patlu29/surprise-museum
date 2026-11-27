/**
 * Space-full guard (ADR 0024, FR-104). The decision is a pure function; `refuseIfSpaceFull`
 * measures through the store, fails open when the measurement errors, and refuses with 409
 * `space_full`. A figure never reaches a response or a log line.
 */
import { ApiException } from './http.ts';
import type { MuseumStore } from './ports.ts';

export interface SpaceUsage {
  storageBytes: number;
  databaseBytes: number;
}

/** Refuse at or above these (80% of the Free plan's 1 GB of files and 500 MB of database). */
export interface SpaceLimits {
  storageBytes: number;
  databaseBytes: number;
}

export const DEFAULT_SPACE_LIMITS: SpaceLimits = {
  storageBytes: 800_000_000,
  databaseBytes: 400_000_000,
};

/** Exactly at a threshold refuses; one byte below accepts. */
export function isSpaceFull(usage: SpaceUsage, limits: SpaceLimits): boolean {
  return usage.storageBytes >= limits.storageBytes || usage.databaseBytes >= limits.databaseBytes;
}

export function spaceFullError(): ApiException {
  return new ApiException('space_full', 'Surprise Museum is full for now. Please try again later.');
}

/** Whether the service is full right now. Fails open: a measurement error means "not full". */
export async function isServiceFull(
  store: MuseumStore,
  limits: SpaceLimits = DEFAULT_SPACE_LIMITS,
): Promise<boolean> {
  try {
    return isSpaceFull(await store.spaceUsage(), limits);
  } catch (error) {
    // The error name only: a message from the database could carry a value.
    console.error(`space check unavailable (${error instanceof Error ? error.name : 'error'})`);
    return false;
  }
}

/** Throws 409 space_full while the service is full. */
export async function refuseIfSpaceFull(
  store: MuseumStore,
  limits: SpaceLimits = DEFAULT_SPACE_LIMITS,
): Promise<void> {
  if (await isServiceFull(store, limits)) throw spaceFullError();
}
