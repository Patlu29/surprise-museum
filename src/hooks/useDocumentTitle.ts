import { useEffect } from 'react';

const SITE = 'Surprise Museum';

/** Sets the page title (WCAG 2.4.2). Pass `null` to use the site name alone. */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : SITE;
  }, [title]);
}
