import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, type Mesh, type MeshBasicMaterial } from 'three';
import type { PhotoSlot } from '@/domain/layout/types';
import { useSessionStore } from '@/state/sessionStore';
import { setPictureHover } from '../controllers/cursor';
import { FRAME } from '../materials/geometry/frames';
import { isReducedMotion } from '../runtime/motion';
import { useRuntime } from '../runtime/RuntimeContext';
import { getFailedGlyph, getLoadingGlyph } from './glyphs';

/**
 * One picture on the wall, inside the technical-artist's frame: the LQIP placeholder, then the
 * wall texture cross-faded in over 400 ms (instant under reduced motion), with in-frame glyphs
 * for loading and failed (design spec 7.4). The photo is unlit (MeshBasicMaterial, never tone
 * mapped) so it is evenly lit: no glare, no shadow (FR-40), and it keeps its aspect ratio
 * (FR-39). A tap or click opens the viewer; a tap on a failed frame retries. Per-frame work
 * mutates refs only. The frame itself, picture light and glow are drawn by Museum.
 */
interface PhotoFrameProps {
  slot: PhotoSlot;
}

const FADE_SECONDS = 0.4;
const TAP_MAX_PX = 8;
const TAP_MAX_MS = 350;
const DIM = new Color('#666666');
const WHITE = new Color('#ffffff');
// Layers along the wall normal, from the recessed photo plane outwards (local z, metres).
const Z_LQIP = FRAME.photoZ + 0.0005;
const Z_FULL = FRAME.photoZ + 0.0015;
const Z_GLYPH = FRAME.mountDepth + 0.004;

export function PhotoFrame({ slot }: PhotoFrameProps) {
  const runtime = useRuntime();
  const lqip = useRef<Mesh>(null);
  const full = useRef<Mesh>(null);
  const glyph = useRef<Mesh>(null);
  const lqipMat = useRef<MeshBasicMaterial>(null);
  const fullMat = useRef<MeshBasicMaterial>(null);
  const glyphMat = useRef<MeshBasicMaterial>(null);
  const local = useRef({ applied: false, fade: 1, glyph: '' });
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const nx = slot.normal.x;

  const lqipTexture = runtime.photos.getLqip(slot.photoId);
  const position = useMemo<[number, number, number]>(
    () => [slot.position.x, slot.position.y, slot.position.z],
    [slot],
  );

  useEffect(
    () => () => {
      setPictureHover(false);
      if (runtime.hoverIndex === slot.index) runtime.hoverIndex = -1;
    },
    [runtime, slot.index],
  );

  useFrame((_, dt) => {
    const st = local.current;
    const photos = runtime.photos;
    const status = photos.statusOf(slot.photoId);
    const reduced = isReducedMotion();

    // A photo that was forced to fail (test hook) goes back to its placeholder.
    if (st.applied && status === 'failed' && !photos.getTexture(slot.photoId)) {
      st.applied = false;
      st.fade = 1;
      if (full.current) full.current.visible = false;
      if (lqip.current) lqip.current.visible = true;
    }

    // Wall texture arrived: cross-fade it over the placeholder.
    if (!st.applied) {
      const tex = photos.getTexture(slot.photoId);
      if (tex && fullMat.current && full.current) {
        fullMat.current.map = tex;
        fullMat.current.needsUpdate = true;
        full.current.visible = true;
        st.applied = true;
        st.fade = reduced ? 1 : 0;
        fullMat.current.opacity = st.fade;
        fullMat.current.transparent = st.fade < 1;
      }
    }
    if (st.applied && st.fade < 1 && fullMat.current) {
      st.fade = Math.min(1, st.fade + dt / FADE_SECONDS);
      fullMat.current.opacity = st.fade;
      if (st.fade >= 1) {
        fullMat.current.transparent = false;
        if (lqip.current) lqip.current.visible = false;
      }
    } else if (st.applied && lqip.current?.visible && st.fade >= 1) {
      lqip.current.visible = false;
    }

    // Placeholder and failed states.
    if (lqipMat.current) lqipMat.current.color.copy(status === 'failed' ? DIM : WHITE);
    let glyphKey = '';
    if (!st.applied)
      glyphKey = status === 'failed' ? 'failed' : status === 'loading' ? 'loading' : '';
    if (glyphKey !== st.glyph) {
      st.glyph = glyphKey;
      if (glyph.current && glyphMat.current) {
        glyph.current.visible = glyphKey !== '';
        if (glyphKey) {
          glyphMat.current.map = glyphKey === 'failed' ? getFailedGlyph() : getLoadingGlyph();
          glyphMat.current.needsUpdate = true;
        }
      }
    }
  });

  const onDown = (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
    e.stopPropagation();
    down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, t: performance.now() };
  };
  const onUp = (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
    e.stopPropagation();
    const d = down.current;
    down.current = null;
    if (!d) return;
    const moved = Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y);
    if (moved > TAP_MAX_PX || performance.now() - d.t > TAP_MAX_MS) return; // a drag, not a tap
    if (runtime.photos.statusOf(slot.photoId) === 'failed') {
      runtime.photos.retry(slot.photoId);
      return;
    }
    useSessionStore.getState().openViewer(slot.photoId);
  };
  const onOver = (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
    e.stopPropagation();
    if (e.nativeEvent.pointerType !== 'mouse') return;
    runtime.hoverIndex = slot.index;
    setPictureHover(true);
  };
  const onOut = () => {
    if (runtime.hoverIndex === slot.index) runtime.hoverIndex = -1;
    setPictureHover(false);
  };
  const handlers = {
    onPointerDown: onDown,
    onPointerUp: onUp,
    onPointerOver: onOver,
    onPointerOut: onOut,
  };

  return (
    <group
      position={position}
      rotation-y={nx > 0 ? Math.PI / 2 : -Math.PI / 2}
      name={`photo-${slot.photoId}`}
      userData={{ photoId: slot.photoId, index: slot.index }}
    >
      <mesh ref={lqip} position-z={Z_LQIP} {...handlers}>
        <planeGeometry args={[slot.width, slot.height]} />
        <meshBasicMaterial ref={lqipMat} map={lqipTexture} toneMapped={false} />
      </mesh>
      <mesh ref={full} position-z={Z_FULL} visible={false} {...handlers}>
        <planeGeometry args={[slot.width, slot.height]} />
        <meshBasicMaterial ref={fullMat} toneMapped={false} />
      </mesh>
      <mesh ref={glyph} position-z={Z_GLYPH} visible={false} raycast={() => null} renderOrder={3}>
        <planeGeometry args={[0.3, 0.3]} />
        <meshBasicMaterial ref={glyphMat} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
