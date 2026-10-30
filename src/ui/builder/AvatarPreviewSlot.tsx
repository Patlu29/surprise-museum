import {
  Component,
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import type { AvatarConfig } from '@contract';
import type { AvatarPreviewProps } from '@/state/avatarPreview';
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
type PreviewComponent = ComponentType<AvatarPreviewProps>;

/**
 * Loads the preview chunk on mount. `React.lazy` would cache a rejected import for good, so Try
 * again could never recover (BUG-8); this host is remounted per attempt (keyed) and calls
 * `import()` afresh, which the browser retries when the earlier request failed.
 */
function PreviewHost(props: AvatarPreviewProps & { onLoadError: () => void }) {
  const { onLoadError, ...previewProps } = props;
  const [Preview, setPreview] = useState<PreviewComponent | null>(null);
  useEffect(() => {
    let cancelled = false;
    import('@/scene/preview/AvatarPreview').then(
      (module) => {
        if (!cancelled) setPreview(() => module.default);
      },
      () => {
        if (!cancelled) onLoadError();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [onLoadError]);
  return Preview ? <Preview {...previewProps} /> : null;
}

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
  const onLoadError = useCallback(() => setFailed(true), []);

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
              <PreviewHost
                onLoadError={onLoadError}
                guide={guide}
                visitor={visitor}
                guideName={guideName}
                visitorName={visitorName}
                active={active}
                yawDegrees={yawDegrees}
                onSelectActive={onSelectActive}
                onReady={() => setReady(true)}
                onError={onLoadError}
              />
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
