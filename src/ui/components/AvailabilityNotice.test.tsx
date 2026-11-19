import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LIMITS } from '@contract';
import { AvailabilityNotice } from './AvailabilityNotice';

const ISO = '2026-11-25T03:30:00Z';
const originalTz = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'Australia/Sydney';
});
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

const render = (expiresAt: string | null | undefined, context: 'published' | 'edit') =>
  renderToStaticMarkup(<AvailabilityNotice expiresAt={expiresAt} context={context} />);

const text = (html: string) => html.replace(/<[^>]+>/g, '');

describe('AvailabilityNotice', () => {
  it('published: states the days and the local end date, then the edit-link line', () => {
    const html = render(ISO, 'published');
    expect(text(html)).toBe(
      `Available for ${LIMITS.retentionDays} days, until 25/11/2026 14:30.Deleting it with your edit link ends it sooner.`,
    );
    expect(html).toContain(`<time dateTime="${ISO}">25/11/2026 14:30</time>`);
  });

  it('edit: uses the "delete it below" second line', () => {
    const html = render(ISO, 'edit');
    expect(html).toContain('You can end it sooner by deleting it below.');
    expect(html).not.toContain('edit link ends it sooner');
    expect(html).toContain('<time dateTime=');
  });

  it.each([null, undefined, '', 'not a date'])(
    'falls back without a <time> or "Invalid Date" for %s',
    (value) => {
      const html = render(value, 'published');
      expect(html).toContain(`Available for ${LIMITS.retentionDays} days.`);
      expect(html).not.toContain('<time');
      expect(html).not.toContain('until');
      expect(html).not.toContain('Invalid');
      expect(html).toContain('Deleting it with your edit link ends it sooner.');
    },
  );

  it('is plain text: no role, live region or aria-label, and the icon is hidden', () => {
    const html = render(ISO, 'published');
    expect(html).not.toMatch(/role=|aria-live|aria-label/);
    expect(html).toContain('aria-hidden="true"');
  });
});
