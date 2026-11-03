import { describe, expect, it } from 'vitest';
import type { BuilderStep, DraftIssue } from '@/state/draft';
import { createInitialFields, validateDraft } from '@/state/draft';
import {
  CARRY_ON_NAME,
  CHARACTERS_ROLE_LINE,
  CLOSING_MESSAGE_PLACEHOLDER,
  DONE_NAME,
  LANDING_REASSURANCE,
  LANDING_STEPS,
  SECTION,
  sortByStep,
  STEP_PURPOSE,
  STILL_TO_DO_LABELS,
  stillToDoLabel,
  titlePlaceholder,
} from './stepCopy';
import { FACE_SHAPE_LABELS, OUTFIT_PATTERN_LABELS } from '@/lib/avatars';
import {
  FACE_SHAPE_GROUP,
  FACE_SHAPE_HELPER,
  MORE_OPTIONS_LABEL,
  MORE_STYLES_GROUP,
  PATTERN_GROUP,
  PATTERN_HELPER,
} from './extraOptions';

/** FR-76 (design spec 12.10): none of the CR-4 copy uses a gendered pronoun or noun. */
const GENDERED = /\b(she|her|hers|herself|he|him|his|himself|girlfriend|boyfriend)\b/i;

function allCopy(): string[] {
  return [
    ...Object.values(STEP_PURPOSE),
    CHARACTERS_ROLE_LINE,
    ...Object.values(STILL_TO_DO_LABELS),
    LANDING_REASSURANCE,
    ...LANDING_STEPS.flatMap((step) => [step.title, step.line]),
    CLOSING_MESSAGE_PLACEHOLDER,
    titlePlaceholder('Alex'),
    ...Object.values(SECTION),
    DONE_NAME,
    CARRY_ON_NAME,
    MORE_OPTIONS_LABEL,
    FACE_SHAPE_GROUP,
    FACE_SHAPE_HELPER,
    ...Object.values(FACE_SHAPE_LABELS),
    MORE_STYLES_GROUP,
    PATTERN_GROUP,
    PATTERN_HELPER,
    ...Object.values(OUTFIT_PATTERN_LABELS),
  ];
}

describe('CR-4 copy', () => {
  it('has a purpose line for each of the four steps', () => {
    for (const step of [1, 2, 3, 4] as BuilderStep[]) expect(STEP_PURPOSE[step].length).toBeGreaterThan(10);
    expect(STEP_PURPOSE[1]).toBe('You can add 1 to 20 photos. JPEG, PNG, WebP or HEIC, up to 15 MB each.');
    expect(STEP_PURPOSE[2]).toBe('Two names are all you need. The rest is optional.');
  });

  it('passes the FR-76 scan', () => {
    for (const text of allCopy()) expect(GENDERED.test(text), text).toBe(false);
  });

  it('names a chip for every issue id validateDraft can return in publish mode', () => {
    const issues = validateDraft(
      {
        fields: createInitialFields(),
        photos: [{ status: 'failed', processed: null } as never],
        consent: false,
      },
      'publish',
    );
    const ids = new Set(issues.map((issue) => issue.id));
    // photos, both names, a failed photo and consent: five of the six ids at once.
    expect([...ids].sort()).toEqual(['consent', 'guide-name', 'photos', 'photos-failed', 'visitor-name']);
    for (const issue of issues) expect(STILL_TO_DO_LABELS[issue.id], issue.id).toBeDefined();
    expect(STILL_TO_DO_LABELS['photos-uploading']).toBe('Wait for photos to finish');
  });

  it('falls back to the issue message for an id with no short label', () => {
    const issue: DraftIssue = { id: 'other', fieldId: 'x', step: 1, message: 'Something else.' };
    expect(stillToDoLabel(issue)).toBe('Something else.');
  });

  it('puts the chips in step order and keeps the list order within a step', () => {
    const make = (id: string, step: BuilderStep): DraftIssue => ({ id, fieldId: id, step, message: id });
    const sorted = sortByStep([make('consent', 4), make('visitor-name', 2), make('photos', 1), make('photos-failed', 1)]);
    expect(sorted.map((issue) => issue.id)).toEqual(['photos', 'photos-failed', 'visitor-name', 'consent']);
  });

  it('uses the placeholder for a blank title and updates it with the name', () => {
    expect(titlePlaceholder('')).toBe('A museum for {name}');
    expect(titlePlaceholder('  Alex ')).toBe('A museum for Alex');
  });

  it('keeps the visible words of the phone buttons inside their accessible names', () => {
    expect(DONE_NAME).toContain('Done');
    expect(CARRY_ON_NAME.toLowerCase()).toContain('carry on');
  });
});
