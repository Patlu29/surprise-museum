import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { DecalBatch } from '../materials/geometry/decals';
import type { LookMaterials } from '../seams';
import { isReducedMotion } from '../runtime/motion';
import { useRuntime } from '../runtime/RuntimeContext';

/**
 * The soft brass glow behind a frame: it brightens gently on desktop hover (design spec 6.5) and
 * for the "Where next?" hint (design spec 5.11: three pulses over about 4 s, held to 6 s; steady
 * under reduced motion). One merged mesh and one draw call for every picture; per-picture
 * intensity is a vertex attribute.
 */
const HOVER_LEVEL = 0.55;

export function FrameGlows({ look }: { look: LookMaterials }) {
  const runtime = useRuntime();
  const { slots } = runtime.layout;
  const batch = useMemo(
    () =>
      slots.length === 0
        ? null
        : new DecalBatch(
            slots.map((slot) => ({
              // A few millimetres off the wall so the glow never z-fights the plaster.
              position: [
                slot.position.x + slot.normal.x * 0.004,
                slot.position.y,
                slot.position.z,
              ] as const,
              rotationY: slot.normal.x > 0 ? Math.PI / 2 : -Math.PI / 2,
              width: slot.frameWidth + 0.55,
              depth: slot.frameHeight + 0.55,
              intensity: 0,
            })),
            'wall',
          ),
    [slots],
  );
  useEffect(() => () => batch?.dispose(), [batch]);
  const levels = useMemo(() => new Float32Array(slots.length), [slots]);

  useFrame((_, dt) => {
    if (!batch) return;
    const reduced = isReducedMotion();
    const rate = Math.min(dt, 0.1) / 0.15;
    const hintIndex =
      runtime.hint.target && runtime.time < runtime.hint.until
        ? slots.findIndex((s) => s.photoId === runtime.hint.target)
        : -1;
    for (let i = 0; i < slots.length; i++) {
      const hover = runtime.hoverIndex === i ? HOVER_LEVEL : 0;
      const hint = i === hintIndex ? (reduced ? 0.6 : 0.5 + 0.3 * Math.sin(runtime.time * 4)) : 0;
      const target = Math.max(hover, hint);
      const current = levels[i] ?? 0;
      const next = reduced ? target : current + Math.max(-rate, Math.min(rate, target - current));
      levels[i] = next;
      batch.setIntensity(i, next);
    }
    batch.commit();
  });

  if (!batch) return null;
  return (
    <mesh geometry={batch.geometry} material={look.hintGlow} raycast={() => null} renderOrder={2} />
  );
}
