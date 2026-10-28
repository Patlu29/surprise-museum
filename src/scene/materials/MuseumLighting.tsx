import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { Texture } from 'three';
import { createWarmEnvironment } from './environment';
import {
  MUSEUM_LIGHTING,
  PREVIEW_LIGHTING,
  applyRendererSettings,
  type LightingConfig,
} from './lighting';
import type { GraphicsQuality } from './quality';

interface RigProps {
  config: LightingConfig;
}

/** Hemisphere plus one warm directional light, no shadow maps. */
function LightRig({ config }: RigProps) {
  const { hemisphere, key } = config;
  return (
    <>
      <hemisphereLight args={[hemisphere.sky, hemisphere.ground, hemisphere.intensity]} />
      <directionalLight color={key.colour} intensity={key.intensity} position={[...key.position]} />
    </>
  );
}

/** Sets tone mapping and exposure on the renderer while mounted. */
function useRendererSettings(config: LightingConfig) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    applyRendererSettings(gl, config);
  }, [gl, config]);
}

export interface MuseumLightingProps {
  quality?: GraphicsQuality;
  /** Called with the environment map once built, so materials can use it. */
  onEnvironment?: (texture: Texture | null, intensity: number) => void;
}

/**
 * The museum's lighting: warm hemisphere and key light (about 3000 K), Neutral tone mapping, and
 * at high quality a small generated environment map for the floor and brass sheen. Mount it once
 * inside the Canvas. No shadows.
 */
export function MuseumLighting({ quality = 'high', onEnvironment }: MuseumLightingProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useRendererSettings(MUSEUM_LIGHTING);

  useEffect(() => {
    if (quality !== 'high') {
      onEnvironment?.(null, 0);
      return;
    }
    const env = createWarmEnvironment(gl);
    scene.environment = env.texture;
    scene.environmentIntensity = MUSEUM_LIGHTING.environmentIntensity;
    onEnvironment?.(env.texture, MUSEUM_LIGHTING.environmentIntensity);
    return () => {
      if (scene.environment === env.texture) scene.environment = null;
      onEnvironment?.(null, 0);
      env.dispose();
    };
  }, [gl, scene, quality, onEnvironment]);

  return <LightRig config={MUSEUM_LIGHTING} />;
}

/** Neutral, slightly cool light for the builder's avatar preview (design spec 9.4). */
export function PreviewLighting() {
  useRendererSettings(PREVIEW_LIGHTING);
  return <LightRig config={PREVIEW_LIGHTING} />;
}

/**
 * Everything the scene's `SceneLights` seam needs in one component: the warm background colour,
 * the lights, tone mapping and (at high quality) the generated environment map.
 * `<SceneLights />` can be dropped in with no props.
 */
export function SceneLights({ quality = 'high' }: { quality?: GraphicsQuality }) {
  return (
    <>
      <color attach="background" args={['#1d1519']} />
      <MuseumLighting quality={quality} />
    </>
  );
}
