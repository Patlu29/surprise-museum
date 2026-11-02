import { useFrame } from '@react-three/fiber';
import type { RefObject } from 'react';
import type { Material, Mesh } from 'three';
import { CEILING_FADE, ceilingOpacityFor, ceilingReducedStep } from '../cameras/ceilingFade';
import { isReducedMotion } from '../runtime/motion';
import { useRuntime } from '../runtime/RuntimeContext';

/**
 * Applies the ceiling cutaway (design spec 6.3) to the ceiling mesh: its opacity follows the
 * camera's height (see `ceilingOpacityFor`; a hard step with hysteresis under reduced motion), and below an opacity of 0.02 the mesh is not drawn.
 * The ceiling is a single flat, down-facing, single-sided surface, so from above it is culled
 * and there is nothing to sort; it is transparent only while it is partly faded, so the common
 * case stays opaque and cheap (same pattern as `PartitionFade`). The value is published as
 * `runtime.ceilingOpacity` for the QA hook. Allocation-free per frame.
 */
export function CeilingFade({
  mesh,
  material,
}: {
  mesh: RefObject<Mesh | null>;
  material: Material;
}) {
  const runtime = useRuntime();

  useFrame((frame) => {
    const y = frame.camera.position.y;
    const opacity = isReducedMotion()
      ? ceilingReducedStep(y, runtime.ceilingOpacity > 0)
      : ceilingOpacityFor(y);
    if (opacity === runtime.ceilingOpacity) return;
    runtime.ceilingOpacity = opacity;
    const visible = opacity >= CEILING_FADE.hideBelow;
    if (mesh.current) mesh.current.visible = visible;
    material.opacity = opacity;
    const transparent = opacity < 0.999;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.depthWrite = !transparent;
      material.needsUpdate = true;
    }
  });

  return null;
}
