import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { useMuseumStore } from '@/state/museumStore';
import { useSessionStore } from '@/state/sessionStore';
import { useSettingsStore } from '@/state/settingsStore';
import { FrameCap } from './FrameCap';
import {
  readDeviceHints,
  readRendererName,
  resolveGraphicsQuality,
  type QualitySetting,
} from './runtime/graphicsQuality';
import { SceneRoot } from './SceneRoot';

/**
 * The single <Canvas> for the Visitor experience and the preview (architecture 6; one canvas
 * only, because iOS limits WebGL contexts). It reads the museum from `museumStore` and talks to
 * the UI only through the stores in src/state and the transient input and screen-rect objects.
 *
 * The graphics tier ('low' or 'high') is chosen automatically: low on phones and weak or
 * software GPUs, high otherwise. `settingsStore.quality` ('auto' or 'low') overrides it, and the
 * chosen tier is published as `<html data-graphics-quality>` so the UI can show it.
 *
 * Rendering is paused while the full-screen viewer is open (design spec 5.8), capped at 30 FPS on
 * phones and in Low graphics (NFR-7), and the device pixel ratio is capped at 1.5 on phones and
 * 2 on desktops (architecture 6.11).
 *
 * Props:
 *  - canvasInput: handle keyboard, drag-to-look and wheel inside the scene. Off by default,
 *    because the Visit UI already does this (src/hooks/useCanvasKeyboard and useLookControls) and
 *    turning both on would apply orbit input twice. It exists for hosts without that UI.
 */
export interface ExperienceProps {
  canvasInput?: boolean;
}

/** Tests can force a tier with `window.__SURPRISE_QUALITY__ = 'high' | 'low'` (E2E mode only). */
function forcedQuality(): QualitySetting | null {
  const w = window as Window & { __SURPRISE_QUALITY__?: unknown; __SURPRISE_E2E__?: boolean };
  if (!w.__SURPRISE_E2E__) return null;
  return w.__SURPRISE_QUALITY__ === 'high' || w.__SURPRISE_QUALITY__ === 'low'
    ? w.__SURPRISE_QUALITY__
    : null;
}

export function Experience({ canvasInput = false }: ExperienceProps) {
  const content = useMuseumStore((s) => s.content);
  const viewerOpen = useSessionStore((s) => s.viewerPhotoId !== null);
  const setting: QualitySetting = useSettingsStore((s) => s.quality);

  // The unmasked GPU name is only known once the context exists, so the first render uses the
  // device hints and the tier is refined as soon as the renderer is known.
  const [renderer, setRenderer] = useState<string | null>(null);
  const hints = useMemo(() => readDeviceHints(renderer), [renderer]);
  const quality = useMemo(
    () => resolveGraphicsQuality(forcedQuality() ?? setting, hints),
    [setting, hints],
  );
  const coarse = hints.coarsePointer;
  const capped = coarse || quality === 'low';
  const dprMax = quality === 'low' ? (coarse ? 1.5 : 1) : coarse ? 1.5 : 2;

  // Exposed for the UI (a future manual toggle can show it) and for tests.
  useEffect(() => {
    document.documentElement.dataset.graphicsQuality = quality;
    return () => {
      delete document.documentElement.dataset.graphicsQuality;
    };
  }, [quality]);

  if (!content) return null;

  return (
    <Canvas
      data-testid="scene-canvas"
      frameloop={viewerOpen || capped ? 'never' : 'always'}
      dpr={[1, dprMax]}
      camera={{ position: [0, 2.2, 4.5], fov: 55, near: 0.1, far: 120 }}
      gl={{ antialias: !coarse, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => setRenderer(readRendererName(gl.getContext()))}
      style={{ position: 'absolute', inset: 0 }}
    >
      <SceneRoot
        content={content}
        anisotropy={coarse ? 2 : 4}
        quality={quality}
        canvasInput={canvasInput}
      />
      {capped && !viewerOpen && <FrameCap fps={30} />}
    </Canvas>
  );
}

export default Experience;
