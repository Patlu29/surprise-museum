import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import type { Material } from 'three';
import type { Partition } from '@/domain/layout/types';
import { smoothingFactor } from '@/domain/math/vec2';
import { segmentClear } from '@/domain/navigation/geometry';
import { isReducedMotion } from '../runtime/motion';
import { useRuntime } from '../runtime/RuntimeContext';
import { PARTITION_FADED_OPACITY } from './partitions';

/**
 * Fades the internal walls that stand between the camera and the Visitor to about 25% opacity
 * (design spec 6.3, integration round 1). In a narrow room the camera sits behind the wall rather
 * than the boom shrinking until she fills the screen. Collision is untouched: this only changes
 * how the wall draws. A wall is transparent only while it is fading, so the common case stays
 * opaque and cheap. Reduced motion: the fade is instant. Allocation-free per frame.
 */
interface PartitionFadeProps {
  partitions: readonly Partition[];
  materials: readonly Material[];
}

export function PartitionFade({ partitions, materials }: PartitionFadeProps) {
  const runtime = useRuntime();
  const levels = useMemo(() => new Float32Array(partitions.length).fill(1), [partitions]);
  const scratch = useMemo(() => ({ cam: { x: 0, z: 0 }, pivot: { x: 0, z: 0 } }), []);

  useFrame((frame, dt) => {
    const cam = frame.camera.position;
    const v = runtime.registry.getSource('visitor').read().position;
    scratch.cam.x = cam.x;
    scratch.cam.z = cam.z;
    scratch.pivot.x = v.x;
    scratch.pivot.z = v.z;
    const reduced = isReducedMotion();
    const k = reduced ? 1 : smoothingFactor(Math.min(dt, 0.1), 0.12);

    for (let i = 0; i < partitions.length; i++) {
      const partition = partitions[i];
      const material = materials[i];
      if (!partition || !material) continue;
      const blocked = !segmentClear(scratch.cam, scratch.pivot, partition.colliders, 0.05);
      const target = blocked ? PARTITION_FADED_OPACITY : 1;
      const current = levels[i] ?? 1;
      let next = current + (target - current) * k;
      if (Math.abs(next - target) < 0.01) next = target;
      if (next === current) continue;
      levels[i] = next;
      runtime.partitionOpacity[i] = next;
      const transparent = next < 0.999;
      material.opacity = next;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.depthWrite = !transparent;
        material.needsUpdate = true;
      }
    }
  });

  return null;
}
