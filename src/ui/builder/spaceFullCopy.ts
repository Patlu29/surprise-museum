/**
 * The space-full message (FR-106, US-75, design spec 13.5). Plain strings in one file so the copy
 * test can check them against US-75 AC-1 and AC-2. The server's own message is never shown here.
 */
export const SPACE_FULL_HEADING = "We're full for now";
export const SPACE_FULL_PARAGRAPHS: readonly [string, string] = [
  "Surprise Museum can't take another museum right now. Space opens up again as older museums reach the end of their week.",
  'Everything you added is still here, so keep this page open and try again later. If you close this page, your words and characters stay saved, but the photos need adding again.',
];
export const SPACE_FULL_TRY_AGAIN = 'Try again';
export const SPACE_FULL_BACK = 'Back to my museum';
