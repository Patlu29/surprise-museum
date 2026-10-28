import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import type { AvatarConfig } from '@contract';
import { isWebGLAvailable } from '@/lib/webgl';
import { Button } from '@/ui/components/Button';
import { NameLabel } from '@/ui/components/NameLabel';

/**
 * The live 3D preview slot (design spec 9.4). The preview canvas is built by the scene-developer at
 * `src/scene/preview/AvatarPreview.tsx` (default export, props in `@/state/avatarPreview`). It is
 * loaded lazily, as the only scene entry point besides `Experience` (ADR 0017), so three.js stays
 * out of the builder's first chunk. If WebGL is unavailable or the canvas fails, the text
 * description is shown and every option still works.
 */
const LazyPreview = lazy(() => import('@/scene/preview/AvatarPreview'));

class PreviewBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface AvatarPreviewSlotProps {
  guide: AvatarConfig;
  visitor: AvatarConfig;
  guideName: string;
  visitorName: string;
  active: 'guide' | 'visitor';
  yawDegrees: number;
  /** Text alternative for the preview picture (kept current by the parent). */
  label: string;
  /** Text description of the active character, announced politely by the parent. */
  descriptions: ReactNode;
  onSelectActive: (role: 'guide' | 'visitor') => void;
}

export function AvatarPreviewSlot({
  guide,
  visitor,
  guideName,
  visitorName,
  active,
  yawDegrees,
  label,
  descriptions,
  onSelectActive,
}: AvatarPreviewSlotProps) {
  const [webgl] = useState(() => isWebGLAvailable());
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);

  // A retry starts from a fresh "getting ready" state.
  useEffect(() => {
    if (attempt === 0) return;
    const timer = window.setTimeout(() => setReady(false), 0);
    return () => window.clearTimeout(timer);
  }, [attempt]);

  const canRender = webgl && !failed;

  return (
    <div className="preview-slot">
      <div className="preview-slot__frame">
        <div
          className="preview-slot__stage"
          role={canRender ? 'img' : undefined}
          aria-label={canRender ? label : undefined}
        >
          {canRender ? (
            <PreviewBoundary key={attempt} onError={() => setFailed(true)}>
              <Suspense fallback={null}>
                <LazyPreview
                  guide={guide}
                  visitor={visitor}
                  guideName={guideName}
                  visitorName={visitorName}
                  active={active}
                  yawDegrees={yawDegrees}
                  onSelectActive={onSelectActive}
                  onReady={() => setReady(true)}
                  onError={() => setFailed(true)}
                />
              </Suspense>
            </PreviewBoundary>
          ) : null}
        </div>

        {canRender && !ready ? (
          <div className="preview-slot__loading" role="status">
            <span className="spinner" aria-hidden="true" /> Getting your characters ready
          </div>
        ) : null}

        {!canRender ? (
          <div className="preview-slot__fallback">
            <div className="preview-slot__labels">
              <NameLabel role="guide" name={guideName} placeholder="Guide" />
              <NameLabel role="visitor" name={visitorName} placeholder="Visitor" />
            </div>
            <p className="preview-slot__message">
              {!webgl
                ? "3D preview isn't available on this device. Your choices are still saved."
                : "We couldn't show the 3D preview. Your choices are still saved."}
            </p>
            {failed && webgl ? (
              <Button
                variant="secondary"
                icon="retry"
                onClick={() => {
                  setFailed(false);
                  setAttempt((value) => value + 1);
                }}
              >
                Try again
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {descriptions}
    </div>
  );
}
