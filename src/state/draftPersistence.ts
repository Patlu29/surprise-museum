import { AVATAR_OPTIONS } from '@contract';
import type { AvatarConfig } from '@contract';
import { DEFAULT_GUIDE_AVATAR, DEFAULT_VISITOR_AVATAR } from '@/lib/avatars';
import type { BuilderStep, DraftFields } from './draft';
import { safeLocalStorage } from './safeStorage';

/**
 * Persists the parts of the draft that are cheap and safe to keep (US-6 AC-3, US-7): the
 * character choices and the builder's text fields, plus the step. Photos are blobs and are not
 * stored here (full draft restore is Release 2, US-29). The edit token is never stored (FR-50).
 *
 * Every function here is silent on failure: unavailable or full storage, corrupt JSON and data
 * from another version all mean "start with an empty draft".
 */

export const DRAFT_STORAGE_KEY = 'surprise-museum:draft:v1';
export const DRAFT_STORAGE_VERSION = 1;

export interface PersistedDraft {
  fields: DraftFields;
  step: BuilderStep;
  maxStep: BuilderStep;
}

const STRING_FIELDS = ['title', 'visitorName', 'guideName', 'closingMessage'] as const;
const AVATAR_KEYS = [
  'skinTone',
  'hairStyle',
  'hairColor',
  'outfitStyle',
  'outfitColor',
  'bodyType',
  'height',
  'facialHair',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStep(value: unknown): value is BuilderStep {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/** Keeps only option ids the app still offers; anything else falls back to the default. */
function restoreAvatar(value: unknown, fallback: AvatarConfig): AvatarConfig {
  const result: AvatarConfig = { ...fallback };
  if (!isRecord(value)) return result;
  for (const key of AVATAR_KEYS) {
    const offered = AVATAR_OPTIONS[key] as ReadonlyArray<unknown> | undefined;
    const candidate = value[key];
    if (offered && offered.includes(candidate)) {
      (result as unknown as Record<string, unknown>)[key] = candidate;
    }
  }
  return result;
}

/** Pure: turns whatever was stored into a draft, or null when it cannot be trusted. */
export function parsePersistedDraft(raw: string | null): PersistedDraft | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.version !== DRAFT_STORAGE_VERSION || !isRecord(data.fields)) {
    return null;
  }
  const stored = data.fields;
  const fields: DraftFields = {
    title: '',
    visitorName: '',
    guideName: '',
    closingMessage: '',
    guideAvatar: restoreAvatar(stored.guideAvatar, DEFAULT_GUIDE_AVATAR),
    visitorAvatar: restoreAvatar(stored.visitorAvatar, DEFAULT_VISITOR_AVATAR),
  };
  for (const key of STRING_FIELDS) {
    const value = stored[key];
    if (typeof value === 'string') fields[key] = value;
  }
  const maxStep = isStep(data.maxStep) ? data.maxStep : 1;
  const step = isStep(data.step) ? data.step : 1;
  return { fields, step, maxStep: Math.max(step, maxStep) as BuilderStep };
}

export function serialiseDraft(draft: PersistedDraft): string {
  const { fields } = draft;
  return JSON.stringify({
    version: DRAFT_STORAGE_VERSION,
    step: draft.step,
    maxStep: draft.maxStep,
    fields: {
      title: fields.title,
      visitorName: fields.visitorName,
      guideName: fields.guideName,
      closingMessage: fields.closingMessage,
      guideAvatar: fields.guideAvatar,
      visitorAvatar: fields.visitorAvatar,
    },
  });
}

export function loadDraft(): PersistedDraft | null {
  return parsePersistedDraft(safeLocalStorage.getItem(DRAFT_STORAGE_KEY) as string | null);
}

export function saveDraft(draft: PersistedDraft): void {
  safeLocalStorage.setItem(DRAFT_STORAGE_KEY, serialiseDraft(draft));
}

export function clearSavedDraft(): void {
  safeLocalStorage.removeItem(DRAFT_STORAGE_KEY);
}
