import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { MuseumContent } from '@contract';
import { focusCanvas, registerCanvasElement } from '@/hooks/canvasFocus';
import { useCanvasKeyboard } from '@/hooks/useCanvasKeyboard';
import { useDelayedUnmount } from '@/hooks/useDelayedUnmount';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useLookControls } from '@/hooks/useLookControls';
import { useSessionAnnouncements } from '@/hooks/useSessionAnnouncements';
import { REPLAY_ANNOUNCEMENT, sceneDescription } from '@/lib/announcements';
import { cssDurationMs } from '@/lib/css';
import { detectInAppBrowser } from '@/lib/inAppBrowser';
import { isWebGLAvailable } from '@/lib/webgl';
import { announce } from '@/state/announcer';
import { clearInput } from '@/state/inputState';
import { clearScreenRects } from '@/state/screenRects';
import type { JumpTarget } from '@/state/sessionStore';
import { useSessionStore } from '@/state/sessionStore';
import { effectiveTitle } from '@/state/draft';
import { Button } from '@/ui/components/Button';
import { ButtonLink } from '@/ui/components/Button';
import { ContextLostDialog } from '@/ui/overlays/ContextLostDialog';
import type { SheetName } from '@/ui/overlays/Hud';
import { PreviewBar } from '@/ui/overlays/PreviewBar';
import { WebGLUnavailableScreen } from '@/ui/screens/WebGLUnavailableScreen';
import { SceneBoundary } from './SceneBoundary';
import { WelcomeScreen } from './WelcomeScreen';

// The only way the UI may load the scene (lint rule): lazily, so three.js stays out of the first view.
const Experience = lazy(() => import('@/scene/Experience'));

// Everything after Start (HUD, sheets, viewer) is a second chunk, fetched once the scene has
// mounted so it arrives while she reads the welcome screen and stays out of the welcome download.
const loadRoamingLayer = () => import('./RoamingLayer');
const RoamingLayer = lazy(loadRoamingLayer);

/** Rendered after Experience inside the same Suspense boundary: it mounts once the scene chunk has. */
function MountSignal({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);
  return null;
}

/**
 * If the scene has not reported `sceneReady` this long after its chunk mounted, Start proceeds
 * anyway, so a scene that forgets to report readiness can never leave the Visitor stuck.
 */
const READY_FALLBACK_MS = 2500;
const CONTROLS_DESCRIPTION =
  'Walk with W A S D or the arrow keys. Turn the view with Q and E. R resets the view, H opens help, P opens the pictures list, and Escape closes panels.';

interface VisitExperienceProps {
  content: MuseumContent;
  mode: 'visit' | 'preview';
  /** Preview only: go back to the builder. Also the action when the graphics context is lost. */
  onExitPreview?: () => void;
}

/**
 * The whole Visitor experience, shared by the share link and the Creator's preview so they are
 * identical (US-8): welcome, then the museum with its HUD, viewer, finale and error states.
 * The scene is mounted behind the welcome screen so it loads while she reads.
 */
export function VisitExperience({ content, mode, onExitPreview }: VisitExperienceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  const [webglOk] = useState(() => isWebGLAvailable());
  const [sceneFailed, setSceneFailed] = useState(false);
  const [chunkMounted, setChunkMounted] = useState(false);
  const [fallbackReady, setFallbackReady] = useState(false);
  const [startRequested, setStartRequested] = useState(false);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [veil, setVeil] = useState<'off' | 'in' | 'out'>('off');
  const veilTimers = useRef<number[]>([]);

  const phase = useSessionStore((state) => state.phase);
  const sceneReady = useSessionStore((state) => state.sceneReady);
  const sceneProgress = useSessionStore((state) => state.sceneProgress);
  const contextLost = useSessionStore((state) => state.contextLost);
  const viewerPhotoId = useSessionStore((state) => state.viewerPhotoId);

  const title = effectiveTitle(content.title, content.visitorName);
  useDocumentTitle(title);
  useSessionAnnouncements(content);

  const ready = sceneReady || fallbackReady;
  const welcomeFade = useMemo(() => cssDurationMs('--duration-slow', 500), []);
  const welcome = useDelayedUnmount(phase === 'welcome', welcomeFade);
  const inAppBrowser = useMemo(() => detectInAppBrowser(navigator.userAgent), []);

  const markChunkMounted = useCallback(() => {
    setChunkMounted(true);
    void loadRoamingLayer().catch(() => undefined);
  }, []);

  useEffect(() => {
    registerCanvasElement(rootRef.current);
    const timers = veilTimers.current;
    return () => {
      registerCanvasElement(null);
      for (const timer of timers) window.clearTimeout(timer);
      clearInput();
      clearScreenRects();
      useSessionStore.getState().reset();
    };
  }, []);

  useEffect(() => {
    if (!chunkMounted || sceneReady) return;
    const timer = window.setTimeout(() => setFallbackReady(true), READY_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [chunkMounted, sceneReady]);

  useEffect(() => {
    if (startRequested && ready && phase === 'welcome') useSessionStore.getState().start();
  }, [startRequested, ready, phase]);

  useEffect(() => {
    if (phase !== 'roaming') return;
    focusCanvas();
    announce(sceneDescription(title, content.guideName, content.photos.length));
    // Announce and focus once, when the visit begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /** A cut hidden by a fade-through veil. The token is 0 ms under reduced motion, so it becomes a hard cut. */
  const runWithVeil = useCallback((action: () => void) => {
    const duration = cssDurationMs('--duration-fade-through', 400);
    if (duration <= 0) {
      action();
      return;
    }
    setVeil('in');
    veilTimers.current.push(
      window.setTimeout(() => {
        action();
        setVeil('out');
        veilTimers.current.push(window.setTimeout(() => setVeil('off'), duration));
      }, duration),
    );
  }, []);

  const jump = useCallback(
    (target: JumpTarget, announcement: string) => {
      setSheet(null);
      runWithVeil(() => {
        useSessionStore.getState().requestJump(target);
        announce(announcement);
      });
    },
    [runWithVeil],
  );

  const replay = useCallback(() => {
    runWithVeil(() => {
      useSessionStore.getState().replay();
      announce(REPLAY_ANNOUNCEMENT);
    });
  }, [runWithVeil]);

  const keyHandlers = useMemo(
    () => ({
      onHelp: () => setSheet('help'),
      onPictures: () => setSheet('pictures'),
      onHint: () => useSessionStore.getState().requestHint(),
      onResetView: () => useSessionStore.getState().resetView(),
      onEscape: () => {
        if (useSessionStore.getState().presentation.kind !== 'none') {
          useSessionStore.getState().dismissPresentation();
        }
      },
      onActivate: () => {
        if (useSessionStore.getState().presentation.kind === 'none') return false;
        useSessionStore.getState().dismissPresentation();
        return true;
      },
    }),
    [],
  );
  useCanvasKeyboard(rootRef, keyHandlers);
  useLookControls(rootRef);

  const viewerIndex = viewerPhotoId
    ? content.photos.findIndex((photo) => photo.id === viewerPhotoId)
    : -1;
  const viewerPhoto = viewerIndex >= 0 ? (content.photos[viewerIndex] ?? null) : null;
  const previewActions =
    mode === 'preview' && onExitPreview ? (
      <Button variant="primary" onClick={onExitPreview}>
        Back to my draft
      </Button>
    ) : (
      <ButtonLink variant="secondary" href="/">
        Go to the home page
      </ButtonLink>
    );

  if (!webglOk || sceneFailed) {
    return <WebGLUnavailableScreen actions={previewActions} />;
  }

  return (
    <div className={['visit', mode === 'preview' && 'visit--preview'].filter(Boolean).join(' ')}>
      {mode === 'preview' && onExitPreview ? (
        <PreviewBar visitorName={content.visitorName} onExit={onExitPreview} />
      ) : null}

      {phase === 'roaming' ? (
        <button type="button" className="skip-link" onClick={focusCanvas}>
          Skip to the museum
        </button>
      ) : null}

      <div
        ref={rootRef}
        className="scene-root"
        tabIndex={0}
        role="application"
        aria-roledescription="3D museum"
        aria-label={`Museum. ${title}. Press H for help.`}
        aria-describedby={descriptionId}
        inert={phase === 'welcome' ? true : undefined}
      >
        <SceneBoundary onError={() => setSceneFailed(true)}>
          <Suspense fallback={null}>
            <Experience />
            <MountSignal onMount={markChunkMounted} />
          </Suspense>
        </SceneBoundary>
      </div>
      <p id={descriptionId} className="visually-hidden">
        {CONTROLS_DESCRIPTION}
      </p>

      <Suspense fallback={null}>
        {chunkMounted ? (
          <RoamingLayer
            content={content}
            phase={phase}
            sheet={sheet}
            onSheet={setSheet}
            onJump={jump}
            onReplay={replay}
            viewerPhoto={viewerPhoto}
            viewerIndex={viewerIndex}
          />
        ) : null}
      </Suspense>

      {welcome.mounted ? (
        <WelcomeScreen
          title={title}
          visitorName={content.visitorName}
          guideName={content.guideName}
          waiting={startRequested && !ready}
          progress={sceneProgress}
          leaving={welcome.leaving}
          inAppBrowser={inAppBrowser}
          onStart={() => setStartRequested(true)}
        />
      ) : null}

      <div className={`veil veil--${veil}`} aria-hidden="true" />

      <ContextLostDialog
        open={contextLost}
        preview={mode === 'preview'}
        onAction={() =>
          mode === 'preview' && onExitPreview ? onExitPreview() : window.location.reload()
        }
      />
    </div>
  );
}
