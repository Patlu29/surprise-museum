import type { MuseumContent } from '@contract';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FollowCameraRig } from './cameras/FollowCameraRig';
import { PresentationCameraController } from './cameras/PresentationCameraController';
import { CharacterView } from './characters/CharacterView';
import { CanvasInput } from './controllers/CanvasInput';
import { installCommands } from './controllers/commands';
import { attachCursor } from './controllers/cursor';
import { SceneDriver } from './controllers/SceneDriver';
import { installTestHooks } from './controllers/testHooks';
import { Museum } from './objects/Museum';
import { PHOTO_MAX_EDGE } from './runtime/graphicsQuality';
import { RuntimeContext } from './runtime/RuntimeContext';
import { createSceneRuntime, type SceneRuntime } from './runtime/SceneRuntime';
import { SceneLights, type GraphicsQuality } from './seams';
import { clearScreenRects } from '@/state/screenRects';
import { useMuseumStore } from '@/state/museumStore';
import { useSessionStore } from '@/state/sessionStore';

interface SceneRootProps {
  content: MuseumContent;
  anisotropy: number;
  /** Graphics tier: low for phones and weak GPUs, high otherwise. */
  quality: GraphicsQuality;
  /** Keyboard, drag-to-look and wheel handling. Turn off only if the UI provides its own. */
  canvasInput: boolean;
}

/** Everything that affects the generated museum or the characters. Photo URLs are not in it. */
function contentKey(c: MuseumContent): string {
  return JSON.stringify([
    c.title,
    c.visitorName,
    c.guideName,
    c.visitorAvatar,
    c.guideAvatar,
    [...c.photos].sort((a, b) => a.position - b.position).map((p) => [p.id, p.width, p.height]),
  ]);
}

interface Session {
  runtime: SceneRuntime;
  rig: FollowCameraRig;
  presenter: PresentationCameraController;
}

/**
 * Lives inside the Canvas. Builds the per-museum runtime in an effect (so React StrictMode's
 * mount, unmount, mount cycle disposes and rebuilds cleanly), wires the stores to the scene, and
 * renders the museum, the two characters and the frame driver.
 */
export function SceneRoot({ content, anisotropy, quality, canvasInput }: SceneRootProps) {
  const gl = useThree((s) => s.gl);
  const [session, setSession] = useState<Session | null>(null);
  const key = contentKey(content);
  // The tier is refined once the GPU name is known, which must not rebuild the runtime (and
  // restart the photo downloads), so the photo loader reads the current tier through a ref.
  const qualityRef = useRef(quality);
  useEffect(() => {
    qualityRef.current = quality;
  }, [quality]);
  // Rebuild only when the museum itself changes, not when signed photo URLs are refreshed.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the identity of `content`
  const stableContent = useMemo(() => content, [key]);

  useEffect(() => {
    const holder: { runtime: SceneRuntime | null } = { runtime: null };
    const runtime = createSceneRuntime({
      content: stableContent,
      anisotropy,
      photoMaxEdge: () => PHOTO_MAX_EDGE[qualityRef.current],
      onPhotoStatus: (id, status) => useMuseumStore.getState().setPhotoStatus(id, status),
      onUrlsExpired: () => {
        // The signed URLs expired: ask the store for fresh ones, then restart what was waiting.
        void useMuseumStore
          .getState()
          .refreshUrls()
          .then(() => {
            const fresh = useMuseumStore.getState().content;
            holder.runtime?.photos.updateUrls(
              (fresh ?? stableContent).photos.map((p) => ({ id: p.id, wallUrl: p.wallUrl })),
            );
          });
      },
    });
    holder.runtime = runtime;

    const rig = new FollowCameraRig(
      runtime.layout.spawn.visitor.heading,
      runtime.layout.spawn.visitor.position,
      { w: window.innerWidth, h: window.innerHeight },
    );

    const presenter = new PresentationCameraController(runtime, rig);
    presenter.attachCanvas(gl.domElement);

    const offCommands = installCommands(runtime, rig, presenter);
    const offPresentation = runtime.registry.onPresentationChange((role, presentation) => {
      // Only the Guide presents. The store marks a presented photo as viewed (A-17).
      if (role === 'guide') useSessionStore.getState().setPresentation(presentation);
    });
    const offHooks = installTestHooks(runtime, rig, gl, presenter);

    // Context loss (NFR-11): tell the UI, which offers a reload.
    const canvas = gl.domElement;
    attachCursor(canvas);
    const onLost = (e: Event) => {
      e.preventDefault();
      useSessionStore.getState().setContextLost(true);
    };
    canvas.addEventListener('webglcontextlost', onLost);

    const offReady = useSessionStore.subscribe(
      (s) => s.sceneReady,
      (ready) => {
        canvas.dataset.sceneReady = String(ready);
      },
      { fireImmediately: true },
    );

    // The runtime owns WebGL resources and downloads, so it must be built and disposed in step
    // with this effect (StrictMode runs it twice). Publishing it to render is the one setState.
    setSession({ runtime, rig, presenter });
    return () => {
      offCommands();
      offPresentation();
      offHooks();
      offReady();
      presenter.dispose();
      canvas.removeEventListener('webglcontextlost', onLost);
      attachCursor(null);
      delete canvas.dataset.sceneReady;
      runtime.dispose();
      clearScreenRects();
      useSessionStore.getState().setPresentation({ kind: 'none' });
      setSession(null);
    };
  }, [stableContent, anisotropy, gl]);

  if (!session) return null;
  const { runtime, rig, presenter } = session;
  return (
    <RuntimeContext.Provider value={runtime}>
      <SceneLights quality={quality} />
      <Museum quality={quality} />
      <CharacterView
        role="guide"
        config={stableContent.guideAvatar}
        name={stableContent.guideName}
      />
      <CharacterView
        role="visitor"
        config={stableContent.visitorAvatar}
        name={stableContent.visitorName}
      />
      <SceneDriver rig={rig} presenter={presenter} />
      {canvasInput && <CanvasInput />}
    </RuntimeContext.Provider>
  );
}
