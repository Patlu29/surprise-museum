import type { AvatarConfig } from '@contract';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { DoubleSide, MeshBasicMaterial, type Group, type Mesh } from 'three';
import { createAnimOutput, createAnimState, stepAnimation } from '@/domain/characters/animation';
import type { CharacterRole } from '@/domain/characters/characterState';
import { segmentClear } from '@/domain/navigation/geometry';
import { SCENE_PALETTE } from '../materials/palette';
import { createFloorRingGeometry } from '../materials/geometry/decals';
import { isReducedMotion } from '../runtime/motion';
import { useRuntime } from '../runtime/RuntimeContext';
import { buildAvatar } from '../seams';
import { NameLabel } from './NameLabel';

/**
 * One character in the scene: the rig (with its own soft blob shadow), the Guide's presentation
 * ring and the name label. It reads the character's state from the registry every frame and never
 * knows which source produced it (NFR-25). Per-frame work mutates refs; nothing here sets React
 * state.
 */
interface CharacterViewProps {
  role: CharacterRole;
  config: AvatarConfig;
  name: string;
}

const HEAD = { x: 0, z: 0 };
const CAMERA = { x: 0, z: 0 };

export function CharacterView({ role, config, name }: CharacterViewProps) {
  const runtime = useRuntime();
  const configKey = JSON.stringify(config);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- configKey is the stable identity of config
  const rig = useMemo(() => buildAvatar(config, role), [configKey, role]);
  useEffect(() => () => rig.dispose(), [rig]);

  const group = useRef<Group>(null);
  const label = useRef<HTMLElement | null>(null);
  const ring = useRef<Mesh>(null);
  const ringLevel = useRef(0);
  const anim = useMemo(() => ({ state: createAnimState(), out: createAnimOutput() }), []);
  const last = useRef({ opacity: -1, labelOpacity: -1, visible: true });

  // Brass ring under the Guide while it presents (design spec 6.7), 0.55 m radius.
  const ringGeometry = useMemo(() => createFloorRingGeometry(0.55, 0.035), []);
  const ringMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: SCENE_PALETTE.brass,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  useEffect(
    () => () => {
      ringGeometry.dispose();
      ringMaterial.dispose();
    },
    [ringGeometry, ringMaterial],
  );

  useFrame((frame, dt) => {
    const g = group.current;
    if (!g) return;
    const s = runtime.registry.getSource(role).read();
    const reduced = isReducedMotion();

    g.position.set(s.position.x, s.position.y, s.position.z);
    g.rotation.y = s.heading;

    // Animation: timing from locomotion, speed and gesture only; the rig turns it into bones.
    rig.applyPose(stepAnimation(anim.state, s, Math.min(dt, 0.1), reduced, anim.out));

    // Opacity: relocate and reduced-motion fades, and the 35% yield (FR-31, FR-62).
    const o = s.opacity;
    const cache = last.current;
    if (o !== cache.opacity) {
      cache.opacity = o;
      rig.setOpacity(o);
      const visible = o > 0.003;
      if (visible !== cache.visible) {
        rig.root.visible = visible;
        cache.visible = visible;
      }
    }

    // Presentation ring: 200 ms fade, instant under reduced motion.
    if (role === 'guide' && ring.current) {
      const target = s.presentation.kind !== 'none' ? o : 0;
      ringLevel.current = reduced
        ? target
        : ringLevel.current + Math.max(-dt / 0.2, Math.min(dt / 0.2, target - ringLevel.current));
      ring.current.visible = ringLevel.current > 0.01;
      ringMaterial.opacity = ringLevel.current * 0.9;
    }

    // Label: hidden behind walls (2D line of sight, ADR 0011) and faded with the character.
    const el = label.current;
    if (el) {
      HEAD.x = s.position.x;
      HEAD.z = s.position.z;
      const cam = frame.camera.position;
      // Outer walls hide a label. An internal wall hides it only while it is opaque: one that is
      // faded because it blocks the camera is see-through, so the label stays.
      CAMERA.x = cam.x;
      CAMERA.z = cam.z;
      let clear = segmentClear(CAMERA, HEAD, runtime.layout.hardColliders, 0.1);
      const partitions = runtime.layout.partitions;
      for (let i = 0; clear && i < partitions.length; i++) {
        if ((runtime.partitionOpacity[i] ?? 1) < 0.5) continue;
        clear = segmentClear(CAMERA, HEAD, partitions[i]?.colliders ?? [], 0.1);
      }
      const target = clear ? Math.min(1, o * 1.2) : 0;
      if (target !== cache.labelOpacity) {
        cache.labelOpacity = target;
        el.style.opacity = String(target);
        el.style.visibility = target > 0.01 ? 'visible' : 'hidden';
      }
    }
  });

  const register = useMemo(
    () => (el: HTMLElement | null) => {
      label.current = el;
      if (el) runtime.labels.set(role, el);
      else runtime.labels.delete(role);
    },
    [runtime, role],
  );

  return (
    <group ref={group} name={`character-${role}`}>
      <primitive object={rig.root} />
      {role === 'guide' && (
        <mesh
          ref={ring}
          geometry={ringGeometry}
          material={ringMaterial}
          visible={false}
          raycast={() => null}
        />
      )}
      <NameLabel role={role} name={name} labelHeight={rig.labelHeight} register={register} />
    </group>
  );
}
