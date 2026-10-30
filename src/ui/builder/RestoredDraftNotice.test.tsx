import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  RESTORED_NOTICE_ANNOUNCEMENT,
  RESTORED_NOTICE_LINE_1,
  RESTORED_NOTICE_LINE_2,
  RestoredDraftNoticeView,
} from './RestoredDraftNotice';

const render = (step: 1 | 2 | 3 | 4, leaving = false) =>
  renderToStaticMarkup(
    <RestoredDraftNoticeView
      step={step}
      leaving={leaving}
      onAddPhotos={() => {}}
      onDismiss={() => {}}
    />,
  );

describe('RestoredDraftNoticeView', () => {
  it('uses the copy deck wording and one combined announcement', () => {
    const html = render(3);
    expect(html).toContain('Photos aren&#x27;t kept after a reload. Please add them again.');
    expect(html).toContain(RESTORED_NOTICE_LINE_2);
    expect(RESTORED_NOTICE_ANNOUNCEMENT).toBe(
      `${RESTORED_NOTICE_LINE_1} ${RESTORED_NOTICE_LINE_2}`,
    );
  });

  it('is information, not an alert: no alert role, no live region of its own, no heading', () => {
    const html = render(2);
    expect(html).not.toMatch(/role=/);
    expect(html).not.toMatch(/aria-live/);
    expect(html).not.toMatch(/<h[1-6]/);
    expect(html).toContain('aria-label="Dismiss notice"');
  });

  it('offers Add photos on steps 2 to 4 only', () => {
    expect(render(1)).not.toContain('Add photos');
    for (const step of [2, 3, 4] as const) expect(render(step)).toContain('Add photos');
  });

  it('hides itself from assistive technology while it fades out', () => {
    expect(render(3, true)).toMatch(/^<div class="restored-notice is-leaving" aria-hidden="true"/);
    expect(render(3, false)).toMatch(/^<div class="restored-notice">/);
  });
});
