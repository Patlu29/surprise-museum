import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { LIMITS } from '@contract';
import { REPORT_PROBLEM_URL } from '@/lib/links';
import { Alert } from '@/ui/components/Alert';

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  useDocumentTitle(title);
  return (
    <div className="page">
      <header className="home__header">
        <Link href="/" className="home__brand">
          Surprise Museum
        </Link>
      </header>
      <main className="page__main legal">
        <h1>{title}</h1>
        <Alert tone="warning" title="Draft for review" role="none">
          <p>
            This is a plain-language summary of how the service works. The full wording is being
            reviewed before launch.
          </p>
        </Alert>
        {children}
        <p>
          Questions or concerns? You can{' '}
          <a href={REPORT_PROBLEM_URL} target="_blank" rel="noopener noreferrer">
            report a problem
          </a>
          .
        </p>
      </main>
    </div>
  );
}

export function PrivacyScreen() {
  return (
    <LegalPage title="Privacy">
      <section className="stack">
        <h2>What we keep</h2>
        <p>
          Only what the person making a museum gives us: their photos, captions, the names they type
          and the closing message. Visitors are never asked for any personal information. There is
          no advertising and no third-party tracking.
        </p>
        <h2>Photos</h2>
        <p>
          Photos are resized and re-saved on your own device before they are uploaded. That removes
          hidden details such as the location and camera information stored inside a photo.
        </p>
        <h2>How long we keep it</h2>
        <p>
          A published museum stays available for {LIMITS.retentionDays} days. An unpublished draft
          is removed after {LIMITS.draftRetentionDays} days. You can delete a museum at any time
          with its private edit link, and its link stops working straight away.
        </p>
        <h2>Where it is kept</h2>
        <p>In Australia, where practicable.</p>
        <h2>Who can see it</h2>
        <p>
          Only people who have the share link. Museums are not listed anywhere and are hidden from
          search engines.
        </p>
      </section>
    </LegalPage>
  );
}

export function TermsScreen() {
  return (
    <LegalPage title="Terms">
      <section className="stack">
        <h2>Your photos and the people in them</h2>
        <p>
          Before publishing you confirm that you have the right to share the photos, and that the
          people in them know about this and are comfortable with it.
        </p>
        <h2>Your edit link</h2>
        <p>
          The private edit link is the only way to change or delete your museum. We cannot recover
          it if you lose it, so save it somewhere safe and do not share it.
        </p>
        <h2>What not to upload</h2>
        <p>
          Do not upload anything unlawful, or anything that you do not have permission to share.
        </p>
        <h2>Availability</h2>
        <p>
          We take care to keep museums available for {LIMITS.retentionDays} days, but we cannot
          promise the service will never be interrupted.
        </p>
      </section>
    </LegalPage>
  );
}
