import { useEffect } from 'react';
import { useParams } from 'wouter';
import { useMuseumStore } from '@/state/museumStore';
import { useSessionStore } from '@/state/sessionStore';
import { LoadingScreen } from '@/ui/screens/LoadingScreen';
import { NotFoundScreen } from '@/ui/screens/NotFoundScreen';
import { CouldntOpenScreen } from '@/ui/screens/CouldntOpenScreen';
import { VisitExperience } from '@/ui/visit/VisitExperience';

/**
 * The Visitor's route, `#/m/:shareToken` (Epic E3, E4): fetch the museum, then show the welcome
 * screen and the museum. Unknown links show "not found" and reveal nothing (FR-55); a failed
 * fetch offers Try again without reloading the page (US-30).
 */
export default function VisitScreen() {
  const { shareToken = '' } = useParams<{ shareToken: string }>();
  const status = useMuseumStore((state) => state.status);
  const source = useMuseumStore((state) => state.source);
  const content = useMuseumStore((state) => state.content);
  const errorCode = useMuseumStore((state) => state.errorCode);

  useEffect(() => {
    useSessionStore.getState().reset();
    void useMuseumStore.getState().loadPublished(shareToken);
    return () => useMuseumStore.getState().clear();
  }, [shareToken]);

  // A stale preview or an earlier museum must never flash before this link has loaded.
  const current = source === 'published';

  if (!current || status === 'idle' || status === 'loading') return <LoadingScreen />;
  if (status === 'not-found') return <NotFoundScreen />;
  if (status === 'error' || !content) {
    return (
      <CouldntOpenScreen
        code={errorCode}
        onRetry={() => void useMuseumStore.getState().loadPublished(shareToken)}
      />
    );
  }
  return <VisitExperience content={content} mode="visit" />;
}
