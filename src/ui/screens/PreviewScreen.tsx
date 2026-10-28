import { useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useBuilderStore } from '@/state/builderStore';
import { buildPreviewContent, validateDraft } from '@/state/draft';
import { useMuseumStore } from '@/state/museumStore';
import { useSessionStore } from '@/state/sessionStore';
import { Button, ButtonLink } from '@/ui/components/Button';
import { LoadingScreen } from '@/ui/screens/LoadingScreen';
import { VisitExperience } from '@/ui/visit/VisitExperience';

/**
 * The Creator's preview (FR-11, US-8): the full Visitor experience from the local draft, built
 * from the same blobs that are uploaded, so preview equals published. If the minimum is not met,
 * it lists what is missing instead of an empty museum.
 */
export default function PreviewScreen() {
  const [, navigate] = useLocation();
  const fields = useBuilderStore();
  const content = useMuseumStore((state) => state.content);
  const source = useMuseumStore((state) => state.source);
  const status = useMuseumStore((state) => state.status);

  const issues = useMemo(
    () => validateDraft({ fields, photos: fields.photos, consent: fields.consent }, 'preview'),
    [fields],
  );
  useDocumentTitle('Preview');

  // Build the preview content once, when the screen opens. Edits happen in the builder, not here.
  useEffect(() => {
    const state = useBuilderStore.getState();
    const missing = validateDraft(
      { fields: state, photos: state.photos, consent: state.consent },
      'preview',
    );
    if (missing.length === 0) {
      useSessionStore.getState().reset();
      useMuseumStore.getState().setPreview(buildPreviewContent(state, state.photos));
    }
    return () => useMuseumStore.getState().clear();
  }, []);

  // Exit preview returns to Review, as the design spec says (US-8).
  const exit = () => {
    useBuilderStore.getState().setStep(4);
    navigate('/create');
  };

  if (issues.length > 0) {
    return (
      <main className="message-screen">
        <div className="message-screen__card">
          <h1>Almost ready to preview</h1>
          <p>A preview needs a photo and both names. Here is what is missing.</p>
          <ul className="stack">
            {issues.map((issue) => (
              <li key={issue.id}>{issue.message}</li>
            ))}
          </ul>
          <div className="row message-screen__actions">
            <Button
              variant="primary"
              onClick={() => {
                const first = issues[0];
                useBuilderStore.getState().setStep(first ? first.step : 1);
                navigate('/create');
              }}
            >
              Back to my draft
            </Button>
            <ButtonLink variant="tertiary" href="/">
              Go to the home page
            </ButtonLink>
          </div>
        </div>
      </main>
    );
  }

  if (source !== 'preview' || status !== 'ready' || !content)
    return <LoadingScreen heading="Getting your preview ready" />;
  return <VisitExperience content={content} mode="preview" onExitPreview={exit} />;
}
