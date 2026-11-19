import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LIMITS } from '@contract';
import { NotFoundScreen } from './NotFoundScreen';
import { PrivacyScreen } from './LegalScreen';

vi.mock('wouter', () => ({
  Link: ({ children, href }: { children: unknown; href: string }) => (
    <a href={href}>{children as never}</a>
  ),
}));
vi.mock('@/hooks/useDocumentTitle', () => ({ useDocumentTitle: () => {} }));

const flat = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ');

describe('not-found screen', () => {
  it('keeps the heading and says museums may have ended after the retention period', () => {
    const text = flat(renderToStaticMarkup(<NotFoundScreen />));
    expect(text).toContain("We can't find that museum");
    expect(text).toContain(
      `The link might have a typo, or the museum may have been deleted. Museums are only kept for ${LIMITS.retentionDays} days, so it may have ended. Check the link, or ask the person who sent it for a new link.`,
    );
    expect(text).not.toContain('taken down');
  });
});

describe('privacy page', () => {
  it('has the no-backups sentence as its own paragraph after the retention paragraph', () => {
    const html = renderToStaticMarkup(<PrivacyScreen />);
    const sentence =
      'Our free plan keeps no backups, and deleted or expired content is removed within 24 hours.';
    const paragraphs = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gs)].map((m) =>
      flat(m[1] ?? '').trim(),
    );
    const retention = paragraphs.findIndex((p) =>
      p.startsWith('A published museum stays available'),
    );
    expect(retention).toBeGreaterThanOrEqual(0);
    expect(paragraphs[retention + 1]).toBe(sentence);
  });
});
