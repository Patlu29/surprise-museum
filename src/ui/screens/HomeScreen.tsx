import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { REPORT_PROBLEM_URL } from '@/lib/links';
import { ButtonLink } from '@/ui/components/Button';
import { Illustration } from '@/ui/components/Illustration';
import { Link } from 'wouter';

/** The landing screen (design spec 2.1, Appendix B). Static, no 3D, no sign-in (FR-1). */
export function HomeScreen() {
  useDocumentTitle(null);
  return (
    <div className="page home">
      <header className="home__header">
        <p className="home__brand">Surprise Museum</p>
      </header>

      <main className="home__main">
        <div className="home__art">
          <Illustration kind="home" />
        </div>
        <div className="stack home__intro">
          <p className="eyebrow">A private view</p>
          <h1 className="home__heading">Turn your photos into a little museum</h1>
          <p className="home__body">
            Add your photos, meet your guide, and send a link. They open it on their phone and
            wander through, with you as their guide.
          </p>
          <ol className="home__steps">
            <li>
              <span className="home__step-number" aria-hidden="true">
                1
              </span>
              Add up to 20 photos
            </li>
            <li>
              <span className="home__step-number" aria-hidden="true">
                2
              </span>
              Make your two characters
            </li>
            <li>
              <span className="home__step-number" aria-hidden="true">
                3
              </span>
              Send the link
            </li>
          </ol>
          <div>
            <ButtonLink variant="primary" large href="/create">
              Create a museum
            </ButtonLink>
          </div>
        </div>
      </main>

      <footer className="home__footer">
        <nav aria-label="Footer">
          <ul className="home__footer-links">
            <li>
              <Link href="/privacy">Privacy</Link>
            </li>
            <li>
              <Link href="/terms">Terms</Link>
            </li>
            <li>
              <a href={REPORT_PROBLEM_URL} target="_blank" rel="noopener noreferrer">
                Report a problem
              </a>
            </li>
          </ul>
        </nav>
      </footer>
    </div>
  );
}
