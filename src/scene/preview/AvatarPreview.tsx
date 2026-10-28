import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Component,
  createRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { MeshBasicMaterial, Vector3, type Group, type PerspectiveCamera } from 'three';
import type { AvatarConfig } from '@contract';
import type { AvatarPreviewProps } from '@/state/avatarPreview';
import { getEffectiveReducedMotion } from '@/state/settingsStore';
import { NameLabelPill } from '../characters/NameLabel';
import { PREVIEW_BACKGROUND } from '../materials/lighting';
import { PreviewLighting } from '../materials/MuseumLighting';
import { SCENE_PALETTE } from '../materials/palette';
import { buildAvatar } from '../seams';

/**
 * The builder's live 3D preview (design spec 6.11 and Appendix A): both characters side by
 * side on small plinths, with their name labels underneath, in neutral light on a soft cream
 * backdrop so skin and hair colours read true while they are chosen. A second, small Canvas that
 * is only mounted in the builder, never together with the museum canvas (iOS limits WebGL
 * contexts). Props are the contract in src/state/avatarPreview.ts.
 *
 * - `yawDegrees` turns the pair about the vertical axis (0 is a three-quarter front view, 180 is
 *   the back view). The turn eases over about 250 ms, and is instant under reduced motion.
 * - The active character has a brass ring on its plinth; clicking a character selects it.
 * - Camera framing is fixed (it adapts only to the canvas shape); only the characters turn.
 * - Idle breathing and sway run with full motion only; reduced motion holds a still pose.
 */
const SPACING = 0.85;
const INWARD = 0.32; // each character turns slightly towards the other: a three-quarter view
const PLINTH_RADIUS = 0.5;

class PreviewBoundary extends Component<
  { onError?: (error: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

type LabelRefs = Record<'guide' | 'visitor', { current: HTMLDivElement | null }>;

export default function AvatarPreview(props: AvatarPreviewProps) {
  const { onError, guideName, visitorName } = props;
  // The labels are plain DOM over the canvas, positioned from the projected plinth each frame.
  // (Several drei Html roots mounting in one commit trip a React 19 warning, and a label
  // overlay is simpler and cheaper here.)
  const labels = useMemo<LabelRefs>(() => ({ guide: createRef(), visitor: createRef() }), []);
  return (
    <PreviewBoundary onError={onError}>
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
        <Canvas
          data-testid="avatar-preview-canvas"
          dpr={[1, 2]}
          camera={{ fov: 28, near: 0.1, far: 30, position: [0, 1.1, 6] }}
          gl={{ antialias: true, powerPreference: 'default' }}
          style={{ width: '100%', height: '100%', touchAction: 'pan-y' }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              onError?.(new Error('The graphics context was lost.'));
            });
          }}
        >
          <color attach="background" args={[PREVIEW_BACKGROUND]} />
          <PreviewLighting />
          <Framing />
          <Pair {...props} labels={labels} />
        </Canvas>
        {(['guide', 'visitor'] as const).map((role) => {
          const name = role === 'guide' ? guideName : visitorName;
          if (name.trim() === '') return null;
          return (
            <div
              key={role}
              ref={(el) => {
                labels[role].current = el;
              }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                pointerEvents: 'none',
                willChange: 'transform',
              }}
            >
              <NameLabelPill
                role={role}
                name={name}
                register={(el) => {
                  if (el) {
                    el.style.opacity = '1';
                    el.style.visibility = 'visible';
                  }
                }}
              />
            </div>
          );
        })}
      </div>
    </PreviewBoundary>
  );
}

/** Fit both characters (about 2.6 m wide, 2.2 m tall with labels) whatever the canvas shape. */
function Framing() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const needHeight = 2.5;
    const needWidth = 2 * (SPACING + PLINTH_RADIUS + 0.35);
    const distance = Math.max(needHeight / (2 * tan), needWidth / (2 * tan * aspect));
    camera.position.set(0, 1.0, distance);
    camera.lookAt(0, 0.95, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

function Pair({
  guide,
  visitor,
  active,
  yawDegrees,
  onSelectActive,
  onReady,
  labels,
}: AvatarPreviewProps & { labels: LabelRefs }) {
  const group = useRef<Group>(null);
  const yaw = useRef((yawDegrees * Math.PI) / 180);
  const target = (yawDegrees * Math.PI) / 180;
  const readyCalled = useRef(false);
  const clock = useRef(0);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const reduced = getEffectiveReducedMotion();
    clock.current += Math.min(dt, 0.1);
    // Take the shortest way round, over about 250 ms.
    let diff = target - yaw.current;
    diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    yaw.current = reduced ? target : yaw.current + diff * Math.min(1, Math.min(dt, 0.1) / 0.08);
    g.rotation.y = yaw.current;
    if (!readyCalled.current) {
      readyCalled.current = true;
      onReady?.();
    }
  });

  return (
    <group ref={group} name="avatar-preview-pair">
      <Figure
        role="guide"
        config={guide}
        x={-SPACING}
        turn={INWARD}
        active={active === 'guide'}
        clock={clock}
        label={labels.guide}
        onSelect={onSelectActive}
      />
      <Figure
        role="visitor"
        config={visitor}
        x={SPACING}
        turn={-INWARD}
        active={active === 'visitor'}
        clock={clock}
        label={labels.visitor}
        onSelect={onSelectActive}
      />
    </group>
  );
}

interface FigureProps {
  role: 'guide' | 'visitor';
  config: AvatarConfig;
  x: number;
  turn: number;
  active: boolean;
  clock: { current: number };
  label: { current: HTMLDivElement | null };
  onSelect?: (role: 'guide' | 'visitor') => void;
}

const projected = new Vector3();

function Figure({ role, config, x, turn, active, clock, label, onSelect }: FigureProps) {
  const anchor = useRef<Group>(null);
  const configKey = JSON.stringify(config);
  // A change rebuilds the character, which is well inside the 1 s target (FR-15).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- configKey is the stable identity of config
  const rig = useMemo(() => buildAvatar(config, role), [configKey, role]);
  useEffect(() => () => rig.dispose(), [rig]);

  const hitMaterial = useMemo(
    () => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  useEffect(() => () => hitMaterial.dispose(), [hitMaterial]);

  useFrame((state) => {
    const reduced = getEffectiveReducedMotion();
    // Put the label under the plinth, in screen space.
    const el = label.current;
    if (el && anchor.current) {
      anchor.current.getWorldPosition(projected).project(state.camera);
      const px = (projected.x * 0.5 + 0.5) * state.size.width;
      const py = (-projected.y * 0.5 + 0.5) * state.size.height;
      el.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
    }
    rig.applyPose({
      walkPhase: 0,
      walkAmount: 0,
      idleTime: reduced ? 0 : clock.current,
      present: 0,
    });
  });

  return (
    <group position={[x, 0, 0]}>
      {/* A low cream plinth; the one being edited gets a brass ring. */}
      <mesh position-y={0.03} raycast={() => null}>
        <cylinderGeometry args={[PLINTH_RADIUS, PLINTH_RADIUS + 0.04, 0.06, 40]} />
        <meshLambertMaterial color={SCENE_PALETTE.podium} />
      </mesh>
      {active && (
        <mesh
          position-y={0.064}
          rotation-x={-Math.PI / 2}
          raycast={() => null}
          data-testid="active-ring"
        >
          <ringGeometry args={[PLINTH_RADIUS * 0.8, PLINTH_RADIUS * 0.9, 48]} />
          <meshBasicMaterial color={SCENE_PALETTE.brass} toneMapped={false} />
        </mesh>
      )}
      <group position-y={0.06} rotation-y={turn}>
        <primitive object={rig.root} />
      </group>
      {/* Invisible click target: characters themselves are never pickable. */}
      <mesh
        position-y={0.06 + rig.height / 2}
        material={hitMaterial}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(role);
        }}
      >
        <cylinderGeometry args={[0.42, 0.42, rig.height, 12]} />
      </mesh>
      <group ref={anchor} position-y={-0.2} />
    </group>
  );
}
