import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { useMuseumStore } from '@/state/museumStore';
import { useSessionStore } from '@/state/sessionStore';
import { useSettingsStore } from '@/state/settingsStore';
import { AdaptiveDpr } from './AdaptiveDpr';
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
 * Rendering is paused while the full-screen viewer is open (design spec 5.8), runs at 10 FPS
 * behind the welcome screen, and is capped at 30 FPS on phones and in Low graphics and at 60 FPS
 * elsewhere (NFR-7). The device pixel ratio is capped at 1.5 on phones and 2 on desktops
 * (architecture 6.11) and drops a step at a time if the device cannot hold its frame rate.
 *
 * Props:
 *  - canvasInput: handle keyboard, drag-to-look and wheel inside the scene. Off by default,
 *    because the Visit UI already does this (src/hooks/useCanvasKeyboard and useLookControls) and
 *    turning both on would apply orbit input twice. It exists for hosts without that UI.
 */
export interface ExperienceProps {
  canvasInput?: boolean;
}

/** Scene frame rate behind the welcome screen. */
const WELCOME_FPS = 10;

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
  const welcome = useSessionStore((s) => s.phase === 'welcome');
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
  const targetFps = coarse || quality === 'low' ? 30 : 60;
  // Nothing is visible behind the opaque welcome screen, and the main thread is busy loading
  // there, so the scene idles at 10 FPS until Start. It keeps rendering so shaders compile and
  // the first photos upload before she taps.
  const renderFps = welcome ? WELCOME_FPS : targetFps;
  const dprMax = quality === 'low' ? (coarse ? 1.5 : 1) : coarse ? 1.5 : 2;

  // The pixel-ratio cap only ever goes down, when the device cannot hold its frame rate. It
  // restarts from the tier's maximum if the tier or the device class changes.
  const [dprDrop, setDprDrop] = useState<{ base: number; cap: number } | null>(null);
  const dprCap = dprDrop && dprDrop.base === dprMax ? dprDrop.cap : dprMax;

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
      frameloop="never"
      dpr={[1, dprCap]}
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
      {!viewerOpen && <FrameCap fps={renderFps} />}
      <AdaptiveDpr
        targetFps={targetFps}
        start={dprCap}
        floor={Math.min(1, dprMax)}
        onCap={(cap) => setDprDrop({ base: dprMax, cap })}
      />
    </Canvas>
  );
}

export default Experience;
