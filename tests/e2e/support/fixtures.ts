import { test as base } from '@playwright/test';
import { createMuseum, trackProblems, type Published } from './app';

export interface Fixtures {
  /** Console, page-error, network and WebGL-warning collector. Call `problems.expectClean()`. */
  problems: ReturnType<typeof trackProblems>;
  /**
   * A 4-photo museum published through the real builder into this test's demo backend.
   * Photo 1 (index 0) hangs on the left wall, 2 on the right, 3 on the left, 4 on the right.
   * Photo 2 has no caption (US-12 AC-4).
   */
  museum: Published;
}

export const MUSEUM_CAPTIONS = ['Caption one: a day at the beach.', '', 'Caption three.', 'Caption four.'];
export const CLOSING = 'Dear Alex,\nThank you for visiting.\n\nLove, Sam';

export const test = base.extend<Fixtures>({
  problems: async ({ page }, use) => {
    await use(trackProblems(page));
  },
  museum: async ({ page, problems }, use) => {
    void problems;
    const museum = await createMuseum(page, {
      photos: 4,
      captions: MUSEUM_CAPTIONS,
      closingMessage: CLOSING,
    });
    await use(museum);
  },
});

export { expect } from '@playwright/test';
