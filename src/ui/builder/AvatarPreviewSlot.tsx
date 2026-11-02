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

type PreviewModule = { default: PreviewComponent };

/**
 * iPhone WebKit remembers a failed module import for the whole session, so importing the same URL
 * again can never succeed (BUG-11). The chunk's own file name is written into this module's chunk
 * by the build, so a retry reads it from there and imports it with a throwaway query value, which
 * is a different URL to the browser. Returns null when the name cannot be found (development
 * server, or a changed build), so the caller falls back to a plain import.
 */
async function importPreviewFresh(attempt: number): Promise<PreviewModule | null> {
  try {
    const source = await (await fetch(import.meta.url, { cache: 'reload' })).text();
    const name = /AvatarPreview-[\w-]+\.js/.exec(source)?.[0];
    if (!name) return null;
    const url = new URL(name, import.meta.url);
    url.searchParams.set('retry', String(attempt));
    return (await import(/* @vite-ignore */ url.href)) as PreviewModule;
  } catch {
    return null;
  }
}

async function loadPreview(attempt: number): Promise<PreviewModule> {
  if (attempt > 0) {
    const fresh = await importPreviewFresh(attempt);
    if (fresh) return fresh;
  }
  return import('@/scene/preview/AvatarPreview');
}

/**
 * Loads the preview chunk on mount. `React.lazy` would cache a rejected import for good, so Try
 * again could never recover (BUG-8); this host is remounted per attempt (keyed) and loads afresh.
 */
function PreviewHost(props: AvatarPreviewProps & { attempt: number; onLoadError: () => void }) {
  const { attempt, onLoadError, ...previewProps } = props;
  const [Preview, setPreview] = useState<PreviewComponent | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadPreview(attempt).then(
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
  }, [attempt, onLoadError]);
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
                attempt={attempt}
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
              attempt > 0 ? (
                // The retry also failed. The draft is saved on every change, including the step, so a
                // reload comes back to the same place.
                <Button variant="secondary" icon="retry" onClick={() => window.location.reload()}>
                  Reload the page
                </Button>
              ) : (
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
              )
            ) : null}
          </div>
        ) : null}
      </div>
      {descriptions}
    </div>
  );
}
