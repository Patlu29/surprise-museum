import type { BuilderStep, DraftIssue } from '@/state/draft';

/**
 * CR-4 builder copy (design spec 12.10). Plain strings in one file so the FR-76 scan and the unit
 * test can read them. Australian English, no gendered words.
 */

/** The purpose line under each step heading (12.4.2). */
export const STEP_PURPOSE: Readonly<Record<BuilderStep, string>> = {
  1: 'You can add 1 to 20 photos. JPEG, PNG, WebP or HEIC, up to 15 MB each.',
  2: 'Two names are all you need. The rest is optional.',
  3: 'Both characters already have a starting look. Change as much or as little as you like.',
  4: 'Check everything, then publish. You can preview first.',
};

/** Step 3 is optional as a whole (12.5.3). */
export const CHARACTERS_OPTIONAL_NOTE = 'Optional: everything here has a starting look';
export const CHARACTERS_ROLE_LINE = "The Guide is you. The Visitor is who you're making this for.";

export const STILL_TO_DO_HEADING = 'Still to do';
export const STILL_TO_DO_READY = 'Ready to publish';

/** Short chip labels by issue id (12.4.3). Anything unknown falls back to the issue's own message. */
export const STILL_TO_DO_LABELS: Readonly<Record<string, string>> = {
  photos: 'Add a photo',
  'photos-uploading': 'Wait for photos to finish',
  'photos-failed': "Fix the photo that didn't upload",
  'visitor-name': "Add the Visitor's name",
  'guide-name': 'Add a Guide name',
  consent: 'Confirm you can share the photos',
};

export function stillToDoLabel(issue: DraftIssue): string {
  return STILL_TO_DO_LABELS[issue.id] ?? issue.message;
}

/** Chips run in step order; within a step the list's own order is kept. */
export function sortByStep(issues: readonly DraftIssue[]): DraftIssue[] {
  return issues
    .map((issue, index) => ({ issue, index }))
    .sort((a, b) => a.issue.step - b.issue.step || a.index - b.index)
    .map((entry) => entry.issue);
}

/** Landing page (12.3, 12.10). */
export const LANDING_REASSURANCE = 'No account needed.';
export const LANDING_STEPS: ReadonlyArray<{ title: string; line: string }> = [
  { title: 'Add up to 20 photos', line: 'Photos hang along the museum in the order you choose.' },
  { title: 'Make your two characters', line: 'Pick a look for you and for your visitor.' },
  { title: 'Send the link', line: 'They open it on their phone and wander through.' },
];

/** Placeholders (12.5.2): defaults are shown, never stored. */
export const CLOSING_MESSAGE_PLACEHOLDER =
  'For example: Thanks for coming. I hope it made you smile.';
export function titlePlaceholder(visitorName: string): string {
  return `A museum for ${visitorName.trim() || '{name}'}`;
}

/** Section titles and tags (12.5). */
export const SECTION = {
  photos: 'Your photos',
  photosNote: 'at least 1 photo',
  names: 'The names',
  sample: 'How it will look',
  optionalWords: 'Make it yours',
  consent: 'Consent',
} as const;

/** The visit's phone buttons (12.7, 12.10): visible word, then the accessible name. */
export const DONE_LABEL = 'Done';
export const DONE_NAME = 'Done with this photo';
export const CARRY_ON_LABEL = 'Carry on';
export const CARRY_ON_NAME = 'Carry on exploring';
