import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Matrix4, Quaternion, Vector3, type Mesh, type Points } from 'three';
import { LAYOUT } from '@/domain/layout/constants';
import { clamp, dist2 } from '@/domain/math/vec2';
import { effectiveTitle } from '@/state/draft';
import { createFloorPoolGeometry } from '../materials/geometry/decals';
import {
  createDustMoteGeometry,
  createLightConeGeometry,
  createPodiumGeometry,
} from '../materials/geometry/finale';
import type { GraphicsQuality } from '../materials/quality';
import { isReducedMotion } from '../runtime/motion';
import { useRuntime } from '../runtime/RuntimeContext';
import {
  createLookMaterials,
  createMuseumMaterials,
  type LookMaterials,
  type MuseumMaterials,
} from '../seams';
import { FrameGlows } from './FrameGlows';
import { buildMuseumDressing } from './museumDressing';
import { buildMuseumShell } from './museumGeometry';
import { PartitionFade } from './PartitionFade';
import { createPartitionMaterials } from './partitions';
import { PhotoFrame } from './PhotoFrame';
import { TitlePlaque } from './TitlePlaque';

/**
 * The museum built from the generated layout, dressed with the technical-artist's look: linen
 * walls, oak floors and the claret runner on plain merged boxes (shader dressing), walnut frames
 * with cream mounts, brass picture lights, soft wall washes, ceiling roses, the finale podium,
 * lectern, light cone and dust motes, and the entrance title plaque. About 20 draw calls for the
 * shell and dressing, plus 2 per picture.
 *
 * `quality` is the graphics tier: low drops the finale cone and dust motes (design spec 1.5) and
 * uses cheaper materials.
 */
export function Museum({ quality }: { quality: GraphicsQuality }) {
  const runtime = useRuntime();
  const { layout, content } = runtime;

  const materials = useMemo(() => createMuseumMaterials(quality), [quality]);
  const look = useMemo(() => createLookMaterials(quality), [quality]);
  const shell = useMemo(() => buildMuseumShell(layout), [layout]);
  const dressing = useMemo(() => buildMuseumDressing(layout), [layout]);
  const partitionMaterials = useMemo(
    () =>
      createPartitionMaterials(
        shell.partitions.map((p) => p.toFinale),
        quality,
      ),
    [shell, quality],
  );
  useEffect(() => () => materials.dispose(), [materials]);
  useEffect(() => () => look.dispose(), [look]);
  useEffect(() => () => shell.dispose(), [shell]);
  useEffect(() => () => dressing.dispose(), [dressing]);
  useEffect(() => () => partitionMaterials.dispose(), [partitionMaterials]);

  // Advance the dust motes' clock and honour reduced motion.
  useFrame((state) => {
    look.update(state.clock.elapsedTime);
    look.setReducedMotion(isReducedMotion());
  });

  return (
    <group name="museum">
      <mesh geometry={shell.walls} material={materials.wall} raycast={() => null} />
      <mesh geometry={shell.wallsFinale} material={materials.wallFinale} raycast={() => null} />
      {shell.partitions.map((p, i) => (
        <mesh
          key={p.z}
          geometry={p.geometry}
          material={partitionMaterials.materials[i]}
          raycast={() => null}
        />
      ))}
      <PartitionFade partitions={layout.partitions} materials={partitionMaterials.materials} />
      <mesh geometry={shell.floors} material={materials.floor} raycast={() => null} />
      <mesh geometry={shell.floorsFinale} material={materials.floorFinale} raycast={() => null} />
      <mesh geometry={shell.ceilings} material={materials.ceiling} raycast={() => null} />
      <mesh geometry={shell.runner} material={materials.runner} raycast={() => null} />

      <mesh geometry={dressing.decor} material={look.decor} raycast={() => null} />
      {dressing.wash && (
        <mesh geometry={dressing.wash} material={look.wallWash} raycast={() => null} />
      )}
      <FrameGlows look={look} />

      {layout.slots.map((slot) => (
        <PhotoFrame key={slot.photoId} slot={slot} />
      ))}

      <FloorPools materials={materials} />
      <FinaleSet look={look} />
      <TitlePlaque
        title={effectiveTitle(content.title, content.visitorName)}
        visitorName={content.visitorName}
        guideName={content.guideName}
        position={[-LAYOUT.halfWidth + 0.01, 1.75, -(LAYOUT.entranceDepth - 2)]}
      />
    </group>
  );
}

/**
 * Soft warm pools on the floor in front of each picture (design spec 1.4). They brighten with
 * the Visitor's proximity (40% at 3 m to 100% at 1.5 m), which makes presentations discoverable
 * without instructions, and fill over the 1 s dwell. One instanced draw call; the instance
 * colour's red channel is the intensity. Reduced motion: stepped rather than continuous.
 */
function FloorPools({ materials }: { materials: MuseumMaterials }) {
  const runtime = useRuntime();
  const { layout } = runtime;
  const mesh = useRef<InstancedMesh>(null);
  const levels = useRef<Float32Array>(new Float32Array(layout.slots.length).fill(-1));
  const tmp = useMemo(() => new Color(), []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
    const matrix = new Matrix4();
    layout.slots.forEach((slot, i) => {
      matrix.compose(
        new Vector3(slot.standingSpot.x, 0.016, slot.standingSpot.z),
        q,
        new Vector3(1.2, 1.6, 1),
      );
      m.setMatrixAt(i, matrix);
      m.setColorAt(i, tmp.setScalar(0));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [layout, tmp]);

  useFrame(() => {
    const m = mesh.current;
    if (!m || layout.slots.length === 0) return;
    const v = runtime.registry.getSource('visitor').read().position;
    const dwell = runtime.director.dwell;
    let dirty = false;
    layout.slots.forEach((slot, i) => {
      const d = dist2({ x: v.x, z: v.z }, slot.zonePoint);
      // 0.4 at 3 m rising to 1.0 at 1.5 m; a faint resting glow beyond that.
      let level = d >= 3 ? 0.3 : 0.4 + 0.6 * clamp((3 - d) / 1.5, 0, 1);
      if (dwell.photoId === slot.photoId) level = Math.min(1, level + dwell.progress * 0.2);
      if (isReducedMotion()) level = Math.round(level * 4) / 4;
      const prev = levels.current[i] ?? -1;
      if (Math.abs(level - prev) > 0.02) {
        levels.current[i] = level;
        m.setColorAt(i, tmp.setScalar(level * 0.45));
        dirty = true;
      }
    });
    if (dirty && m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  if (layout.slots.length === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, layout.slots.length]}
      material={materials.pool}
      frustumCulled={false}
      raycast={() => null}
    >
      <planeGeometry args={[1, 1]} />
    </instancedMesh>
  );
}

/**
 * The finale room's set pieces (design spec 1.5): the podium with its brass ring (brightens over
 * 300 ms on enter, instant under reduced motion), a warm floor pool that grows 15%, the light
 * cone, and the dust motes (40 points). At low quality there is no cone and no motes, and under
 * reduced motion the motes are hidden.
 */
function FinaleSet({ look }: { look: LookMaterials }) {
  const runtime = useRuntime();
  const { finale } = runtime.layout;
  const pool = useRef<Mesh>(null);
  const motes = useRef<Points>(null);
  const level = useRef(0);

  const podium = useMemo(() => createPodiumGeometry(), []);
  const poolGeometry = useMemo(() => createFloorPoolGeometry(3.8, 3.8), []);
  const cone = useMemo(
    () =>
      look.cone
        ? createLightConeGeometry({ radiusTop: 0.4, radiusBottom: 1.5, height: 3.2 })
        : null,
    [look],
  );
  const moteGeometry = useMemo(
    () => (look.motes ? createDustMoteGeometry({ count: 32 }) : null),
    [look],
  );
  useEffect(() => () => podium.dispose(), [podium]);
  useEffect(() => () => poolGeometry.dispose(), [poolGeometry]);
  useEffect(() => () => cone?.dispose(), [cone]);
  useEffect(() => () => moteGeometry?.dispose(), [moteGeometry]);

  useFrame((_, dt) => {
    const reduced = isReducedMotion();
    const on = runtime.registry.getSource('guide').read().presentation.kind === 'finale';
    const target = on ? 1 : 0;
    level.current = reduced
      ? target
      : level.current +
        clamp(target - level.current, -Math.min(dt, 0.1) / 0.3, Math.min(dt, 0.1) / 0.3);
    look.podium.uGlow.value = 1 + 0.8 * level.current;
    pool.current?.scale.setScalar(1 + 0.15 * level.current);
    if (motes.current) motes.current.visible = !reduced;
  });

  return (
    <group position={[finale.center.x, 0, finale.center.z]}>
      <mesh geometry={podium} material={look.podium} raycast={() => null} />
      <mesh
        ref={pool}
        geometry={poolGeometry}
        material={look.podiumPool}
        position-y={0.02}
        raycast={() => null}
      />
      {cone && look.cone && (
        <mesh
          geometry={cone}
          material={look.cone}
          position-y={1.6}
          raycast={() => null}
          renderOrder={2}
        />
      )}
      {moteGeometry && look.motes && (
        <points
          ref={motes}
          geometry={moteGeometry}
          material={look.motes}
          frustumCulled={false}
          raycast={() => null}
        />
      )}
    </group>
  );
}
