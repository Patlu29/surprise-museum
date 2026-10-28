import { LIMITS } from '@contract';
import { sniffImageKind } from './sniff';
import type { SourceKind } from './types';

export type FileCheck = { ok: true; kind: SourceKind } | { ok: false; reason: string };

const MAX_MB = Math.round(LIMITS.maxSourceFileBytes / (1024 * 1024));

/**
 * Checks one picked file against FR-2 and FR-3. The reason is shown next to the file name, so it
 * is written for the Creator. `header` is the first bytes of the file (64 is plenty).
 */
export function checkSourceFile(file: { size: number }, header: Uint8Array): FileCheck {
  if (file.size === 0) return { ok: false, reason: 'The file is empty.' };
  if (file.size > LIMITS.maxSourceFileBytes) {
    return { ok: false, reason: `It is larger than ${MAX_MB} MB.` };
  }
  const kind = sniffImageKind(header);
  if (!kind) return { ok: false, reason: 'It is not a JPEG, PNG, WebP or HEIC photo.' };
  return { ok: true, kind };
}

/** Reads the header from a real `File` and runs `checkSourceFile`. */
export async function validateSourceFile(file: File): Promise<FileCheck> {
  let header: Uint8Array;
  try {
    header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  } catch {
    return { ok: false, reason: 'We could not read this file.' };
  }
  return checkSourceFile(file, header);
}
