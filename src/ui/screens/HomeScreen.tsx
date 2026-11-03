import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { REPORT_PROBLEM_URL } from '@/lib/links';
import { ButtonLink } from '@/ui/components/Button';
import { FrameMark } from '@/ui/components/FrameMark';
import { Illustration } from '@/ui/components/Illustration';
import { LANDING_REASSURANCE, LANDING_STEPS } from '@/ui/builder/stepCopy';
import { Link } from 'wouter';

/**
 * The landing screen (design spec 12.3, Appendix B). Static, no 3D, no sign-in (FR-1). DOM order
 * is the reading order: eyebrow, heading, description, Create a museum, the three steps, then the
 * framed illustration (decorative). On desktop the illustration sits in the right column.
 */
export function HomeScreen() {
  useDocumentTitle(null);
  return (
    <div className="page home">
      <header className="home__header">
        <p className="home__brand">
          <FrameMark />
          <span>Surprise Museum</span>
        </p>
      </header>

      <main className="home__main">
        <div className="home__intro">
          <p className="eyebrow eyebrow--rule">A private view</p>
          <h1 className="home__heading">Turn your photos into a little museum</h1>
          <p className="home__body">
            Add your photos, meet your guide, and send a link. They open it on their phone and
            wander through, with you as their guide.
          </p>
          <div className="home__cta">
            <ButtonLink variant="primary" large href="/create" className="home__create">
              Create a museum
            </ButtonLink>
            <p className="home__reassure">{LANDING_REASSURANCE}</p>
          </div>
          <ol className="home__steps">
            {LANDING_STEPS.map((step, index) => (
              <li key={step.title} style={{ ['--i' as string]: index }}>
                <span className="home__step-number" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="home__step-text">
                  <span className="home__step-title">{step.title}</span>
                  <span className="home__step-line">{step.line}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="home__art">
          <div className="home__frame">
            <Illustration kind="home" />
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
