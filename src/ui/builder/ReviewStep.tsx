import { getApiMode } from '@/api';
import { describeAvatar } from '@/lib/avatars';
import { useBuilderStore } from '@/state/builderStore';
import type { BuilderStep, DraftIssue } from '@/state/draft';
import { effectiveTitle, FIELD_IDS, summarisePhotos, usablePhotos } from '@/state/draft';
import { Alert } from '@/ui/components/Alert';
import { Button } from '@/ui/components/Button';
import { DemoNotice } from '@/ui/components/DemoNotice';
import { Icon } from '@/ui/components/Icon';

interface ReviewStepProps {
  issues: readonly DraftIssue[];
  onEditStep: (step: BuilderStep) => void;
  onPreview: () => void;
  onPublish: () => void;
}

/**
 * Step 4: check everything, give consent, preview and publish (FR-56, US-22, design spec 2.1).
 * Publishing cannot run twice and a failure keeps all work.
 */
export function ReviewStep({ issues, onEditStep, onPreview, onPublish }: ReviewStepProps) {
  const state = useBuilderStore();
  const { title, visitorName, guideName, closingMessage, photos, consent, publish } = state;
  const summary = summarisePhotos(photos);
  const usable = usablePhotos(photos);
  const publishing = publish.phase === 'publishing';
  const consentIssue = issues.find((issue) => issue.id === 'consent');
  const blocking = issues.filter(
    (issue) => issue.id === 'photos-uploading' || issue.id === 'photos-failed',
  );

  return (
    <div className="stack">
      <section className="review-card stack" aria-labelledby="review-museum">
        <div className="row review-card__head">
          <h2 id="review-museum">Your museum</h2>
          <Button variant="tertiary" onClick={() => onEditStep(2)}>
            Edit words<span className="visually-hidden"> (step 2)</span>
          </Button>
        </div>
        <dl className="review-list">
          <div>
            <dt>Title</dt>
            <dd className="user-text">{effectiveTitle(title, visitorName)}</dd>
          </div>
          <div>
            <dt>For</dt>
            <dd className="user-text">{visitorName}</dd>
          </div>
          <div>
            <dt>Guide</dt>
            <dd className="user-text">{guideName}</dd>
          </div>
          <div>
            <dt>Closing message</dt>
            <dd className="user-text">
              {closingMessage.trim() || 'None. The finale will say "The end".'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="review-card stack" aria-labelledby="review-photos">
        <div className="row review-card__head">
          <h2 id="review-photos">
            {summary.total} {summary.total === 1 ? 'photo' : 'photos'}
          </h2>
          <Button variant="tertiary" onClick={() => onEditStep(1)}>
            Edit photos<span className="visually-hidden"> (step 1)</span>
          </Button>
        </div>
        <ul className="review-thumbs" aria-label="Photos in order">
          {usable.map((photo, index) => (
            <li key={photo.localId}>
              <span
                className="review-thumbs__item"
                style={{ backgroundImage: `url(${photo.lqip})` }}
              >
                <img src={photo.wallUrl} alt={`Photo ${index + 1}`} />
              </span>
            </li>
          ))}
        </ul>
        {summary.busy > 0 ? (
          <p role="status" className="muted">
            {summary.busy} still being prepared...
          </p>
        ) : null}
      </section>

      <section className="review-card stack" aria-labelledby="review-characters">
        <div className="row review-card__head">
          <h2 id="review-characters">Characters</h2>
          <Button variant="tertiary" onClick={() => onEditStep(3)}>
            Edit characters<span className="visually-hidden"> (step 3)</span>
          </Button>
        </div>
        <p className="user-text">
          {describeAvatar(state.guideAvatar, guideName.trim() || 'Guide')}
        </p>
        <p className="user-text">
          {describeAvatar(state.visitorAvatar, visitorName.trim() || 'Visitor')}
        </p>
      </section>

      <div className="stack">
        <label className={['consent', consentIssue && 'consent--error'].filter(Boolean).join(' ')}>
          <input
            id={FIELD_IDS.consent}
            type="checkbox"
            checked={consent}
            aria-invalid={consentIssue ? true : undefined}
            aria-describedby={consentIssue ? 'consent-error' : undefined}
            onChange={(event) => state.setConsent(event.target.checked)}
          />
          <span>
            I have the right to share these photos, and the people in them know about this and are
            comfortable with it.
          </span>
        </label>
        <p className="consent__links">
          <a href="#/terms" target="_blank" rel="noopener noreferrer">
            Read the terms<span className="visually-hidden"> (opens in a new tab)</span>
          </a>
          {' · '}
          <a href="#/privacy" target="_blank" rel="noopener noreferrer">
            Privacy policy<span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </p>
        {consentIssue ? (
          <p id="consent-error" className="field__error">
            <Icon name="alert" size="sm" /> {consentIssue.message}
          </p>
        ) : null}
      </div>

      {getApiMode() === 'mock' ? <DemoNotice /> : null}

      {publish.phase === 'failed' && publish.error ? (
        <Alert tone="danger" title="Publishing didn't work">
          <p>{publish.error}</p>
        </Alert>
      ) : null}

      <div className="stack">
        <div className="row">
          <Button variant="secondary" icon="eye" onClick={onPreview}>
            Preview
          </Button>
          <Button
            variant="primary"
            large
            loading={publishing}
            unavailable={blocking.length > 0}
            aria-describedby={blocking.length > 0 ? 'publish-reason' : undefined}
            onClick={onPublish}
          >
            {publishing
              ? 'Publishing your museum...'
              : publish.phase === 'failed'
                ? 'Try again'
                : 'Publish museum'}
          </Button>
        </div>
        {blocking.length > 0 ? (
          <p id="publish-reason" className="muted">
            {blocking[0]?.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
