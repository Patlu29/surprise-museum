import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';
import { useBuilderStep } from '@/hooks/useBuilderStep';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { announce } from '@/state/announcer';
import { useBuilderStore } from '@/state/builderStore';
import type { BuilderStep, DraftIssue } from '@/state/draft';
import { BUILDER_STEPS, hasDraftContent, validateDraft } from '@/state/draft';
import { publishDraft } from '@/state/publish';
import { retryNetworkFailures } from '@/state/uploadQueue';
import { Alert } from '@/ui/components/Alert';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';
import { CharactersStep } from './CharactersStep';
import { PhotosStep } from './PhotosStep';
import { PublishedScreen } from './PublishedScreen';
import { RestoredDraftNotice } from './RestoredDraftNotice';
import { ReviewStep } from './ReviewStep';
import { Stepper } from './Stepper';
import { WordsStep } from './WordsStep';

function focusField(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ block: 'center' });
  element.focus({ preventScroll: true });
}

/**
 * The builder: one route with four steps held in history state (design spec 2.1). On each step
 * change focus moves to the step heading and a polite status announces it. Failed Next presses
 * show a summary with a link to each problem and move focus to it (WCAG 3.3.1, 3.3.3).
 */
export default function CreateScreen() {
  const [, navigate] = useLocation();
  const { step, goTo } = useBuilderStep();
  const maxStep = useBuilderStore((state) => state.maxStep);
  const publishPhase = useBuilderStore((state) => state.publish.phase);
  const acknowledged = useBuilderStore((state) => state.editLinkAcknowledged);
  const dirty = useBuilderStore((state) => hasDraftContent(state, state.photos));
  const online = useOnlineStatus();

  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const [attempt, setAttempt] = useState<{ step: BuilderStep; issues: DraftIssue[] } | null>(null);
  const [missing, setMissing] = useState<DraftIssue[] | null>(null);

  const published = publishPhase === 'done';
  const label = BUILDER_STEPS.find((item) => item.step === step)?.label ?? '';
  useDocumentTitle(
    published ? 'Your museum is ready' : `${label}, step ${step} of ${BUILDER_STEPS.length}`,
  );
  // The edit link is shown once, so keep the leave-site prompt until it has been acknowledged.
  useBeforeUnload(published ? !acknowledged : dirty);

  useEffect(() => {
    if (online) retryNetworkFailures();
  }, [online]);

  // Focus the step heading and announce the step (design spec 5.16).
  useEffect(() => {
    if (published) return;
    announce(`Step ${step} of ${BUILDER_STEPS.length}: ${label}`);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: false });
  }, [step, label, published]);

  // After a failed Next or Publish, focus moves to the summary of problems (WCAG 3.3.1).
  useEffect(() => {
    if (attempt && attempt.issues.length > 0) summaryRef.current?.focus();
  }, [attempt]);

  const activeAttempt = attempt && attempt.step === step ? attempt.issues : [];

  const requireIssues = (issues: DraftIssue[]): boolean => {
    if (issues.length === 0) {
      setAttempt(null);
      return true;
    }
    setAttempt({ step, issues });
    return false;
  };

  const snapshot = () => {
    const state = useBuilderStore.getState();
    return { fields: state, photos: state.photos, consent: state.consent };
  };

  const next = () => {
    const previewIssues = validateDraft(snapshot(), 'preview');
    if (step === 1 && !requireIssues(previewIssues.filter((issue) => issue.step === 1))) return;
    if (step === 2 && !requireIssues(previewIssues.filter((issue) => issue.step === 2))) return;
    setAttempt(null);
    goTo(Math.min(4, step + 1) as BuilderStep);
  };

  const back = () => {
    setAttempt(null);
    goTo(Math.max(1, step - 1) as BuilderStep);
  };

  const preview = () => {
    const issues = validateDraft(snapshot(), 'preview');
    if (issues.length > 0) setMissing(issues);
    else navigate('/create/preview');
  };

  const publish = () => {
    const issues = validateDraft(snapshot(), 'publish');
    if (issues.length > 0) {
      requireIssues(issues);
      const consent = issues.find((issue) => issue.id === 'consent');
      if (consent && issues.length === 1) window.setTimeout(() => focusField(consent.fieldId), 0);
      return;
    }
    setAttempt(null);
    void publishDraft();
  };

  const goToIssue = (issue: DraftIssue) => {
    setMissing(null);
    if (issue.step !== step) goTo(issue.step);
    window.setTimeout(() => focusField(issue.fieldId), 50);
  };

  if (published) {
    return (
      <div className="page builder builder--published">
        <header className="builder__header">
          <p className="home__brand">Surprise Museum</p>
        </header>
        <main className="page__main">
          <PublishedScreen />
        </main>
      </div>
    );
  }

  return (
    <div className="page builder">
      {!online ? (
        <p className="offline-bar" role="status">
          You&apos;re offline. We&apos;ll carry on when you&apos;re back.
        </p>
      ) : null}
      <header className="builder__header">
        <Link href="/" className="home__brand">
          Surprise Museum
        </Link>
        <Button variant="tertiary" icon="eye" onClick={preview}>
          Preview
        </Button>
      </header>

      <div className="builder__layout">
        <Stepper
          step={step}
          maxStep={maxStep}
          onSelect={(target) => {
            setAttempt(null);
            goTo(target);
          }}
        />

        <main className="builder__content">
          <h1 ref={headingRef} tabIndex={-1} className="builder__heading">
            {label}
          </h1>

          <RestoredDraftNotice
            step={step}
            onAddPhotos={() => {
              setAttempt(null);
              goTo(1);
            }}
            onDismissed={() => headingRef.current?.focus()}
          />

          {activeAttempt.length > 0 ? (
            <Alert
              tone="danger"
              title={
                activeAttempt.length === 1
                  ? 'One thing needs fixing'
                  : `${activeAttempt.length} things need fixing`
              }
              headingRef={(element) => {
                summaryRef.current = element;
              }}
              tabIndex={-1}
            >
              <ul>
                {activeAttempt.map((issue) => (
                  <li key={issue.id}>
                    <button type="button" className="link-button" onClick={() => goToIssue(issue)}>
                      {issue.message}
                    </button>
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {step === 1 ? <PhotosStep /> : null}
          {step === 2 ? <WordsStep issues={activeAttempt} /> : null}
          {step === 3 ? <CharactersStep /> : null}
          {step === 4 ? (
            <ReviewStep
              issues={activeAttempt}
              onEditStep={(target) => goTo(target)}
              onPreview={preview}
              onPublish={publish}
            />
          ) : null}
        </main>
      </div>

      <div className="builder__actions">
        <div className="builder__actions-inner">
          {step > 1 ? (
            <Button variant="secondary" onClick={back}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 4 ? (
            <Button variant="primary" onClick={next}>
              Next
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog
        open={missing !== null}
        onClose={() => setMissing(null)}
        title="Almost ready to preview"
        description="A preview needs a photo and both names. Here is what is missing."
      >
        <ul className="stack">
          {(missing ?? []).map((issue) => (
            <li key={issue.id}>
              <button type="button" className="link-button" onClick={() => goToIssue(issue)}>
                {issue.message}
              </button>
            </li>
          ))}
        </ul>
        <div className="dialog__actions">
          <Button variant="secondary" onClick={() => setMissing(null)}>
            Close
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
