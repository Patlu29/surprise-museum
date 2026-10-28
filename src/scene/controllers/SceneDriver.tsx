import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import { dist2, normalize2, type Vec2 } from '@/domain/math/vec2';
import type { Room } from '@/domain/layout/types';
import { consumeOrbitDelta, consumeZoomDelta, inputState } from '@/state/inputState';
import { clearScreenRects, publishScreenRects } from '@/state/screenRects';
import { useSessionStore } from '@/state/sessionStore';
import { avatarHeight } from '../characters/avatarRig';
import type { FollowCameraRig } from '../cameras/FollowCameraRig';
import { isReducedMotion } from '../runtime/motion';
import { useRuntime } from '../runtime/RuntimeContext';
import { FRAME_COMMANDS } from './frameQueue';
import { characterCorners, frameCorners, projectPoints, unionRect } from './projection';

/**
 * The per-frame conductor (priority -10 so it runs before anything that draws):
 *   input -> camera yaw, pitch, boom -> registry.tickAll (Visitor, then Guide) -> follow camera
 *   -> discrete outputs to the stores, and screen rectangles about every 100 ms.
 * Per-frame data stays in refs and sources; stores only get discrete changes (architecture 8).
 */
const RECT_INTERVAL = 0.1;
const RANK_INTERVAL = 0.5;
const FAILED_INTERVAL = 0.25;
const READY_TIMEOUT = 6;

function roomOf(rooms: readonly Room[], p: Vec2): Room | null {
  for (const room of rooms) {
    const b = room.bounds;
    if (p.x >= b.minX - 0.3 && p.x <= b.maxX + 0.3 && p.z >= b.minZ && p.z <= b.maxZ) return room;
  }
  return null;
}

export function SceneDriver({ rig }: { rig: FollowCameraRig }) {
  const runtime = useRuntime();
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const heights = useMemo(
    () => ({
      visitor: avatarHeight(runtime.content.visitorAvatar),
      guide: avatarHeight(runtime.content.guideAvatar),
    }),
    [runtime],
  );

  // Internal walls fade rather than shorten the camera boom (see PartitionFade).
  const softColliders = useMemo(
    () => runtime.layout.partitions.flatMap((p) => p.colliders),
    [runtime],
  );
  const timers = useRef({ rects: 0, rank: 0, failed: 0, rectsLive: false });
  const last = useRef({
    visitorSeq: -1,
    areaKey: '',
    offDefault: false,
    progress: -1,
    ready: false,
    nearFailed: null as string | null,
    hintShown: false,
  });
  const mountedAt = useRef(0);

  useEffect(() => {
    mountedAt.current = performance.now();
    return () => {
      clearScreenRects();
    };
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    const rt = runtime;
    rt.time += dt;
    const session = useSessionStore.getState();
    const reduced = isReducedMotion();
    const roaming = session.phase === 'roaming';
    const blocked = !roaming || session.viewerPhotoId !== null;

    // ---- Queued commands (dismiss, replay, jump, reset view, hint, retry) ----------------------
    if (FRAME_COMMANDS.queue.length > 0) {
      const queue = FRAME_COMMANDS.queue.splice(0);
      for (const run of queue) run();
    }

    // ---- Camera input and composition -----------------------------------------------------
    rig.setViewport(camera, size.width, size.height);
    rt.view.fovY = rig.fovYRadians;
    rt.view.aspect = size.width / Math.max(1, size.height);
    const drag = consumeOrbitDelta();
    const zoom = consumeZoomDelta();
    if (blocked) {
      // Input is ignored while the welcome screen or the full-screen viewer is up.
    } else {
      rig.applyInput(dt, {
        rateYawDeg: inputState.orbitRate.yaw,
        ratePitchDeg: inputState.orbitRate.pitch,
        deltaYawDeg: drag.yaw,
        deltaPitchDeg: drag.pitch,
        zoomMetres: zoom,
      });
    }

    // ---- Autopilot (tests and tooling) ----------------------------------------------------
    const visitorBefore = rt.registry.getSource('visitor').read();
    const vp: Vec2 = { x: visitorBefore.position.x, z: visitorBefore.position.z };
    const auto = rt.autopilot;
    if (auto.target) {
      if (dist2(vp, auto.target) < 0.2) {
        auto.target = null;
        auto.intent.x = 0;
        auto.intent.y = 0;
      } else {
        const next = rt.nav.findPath(vp, auto.target)?.[0] ?? auto.target;
        const d = normalize2({ x: next.x - vp.x, z: next.z - vp.z });
        const f = rig.pose.forward;
        const fl = Math.hypot(f.x, f.z) || 1;
        const fwd = { x: f.x / fl, z: f.z / fl };
        auto.intent.x = d.x * -fwd.z + d.z * fwd.x;
        auto.intent.y = d.x * fwd.x + d.z * fwd.z;
      }
    }

    // ---- Characters ----------------------------------------------------------------------
    rt.guide.setPaused(!roaming);
    rt.registry.tickAll(dt, {
      time: rt.time,
      reducedMotion: reduced,
      camera: {
        position: rig.pose.position,
        forward: rig.pose.forward,
      },
    });
    const visitor = rt.registry.getSource('visitor').read();
    const teleported = visitor.teleportSeq !== last.current.visitorSeq;
    last.current.visitorSeq = visitor.teleportSeq;
    rig.update(
      dt,
      camera,
      visitor.position,
      teleported,
      rt.layout.hardColliders,
      softColliders,
      reduced,
    );
    rt.rendered = true;

    // ---- Discrete outputs ------------------------------------------------------------------
    const here: Vec2 = { x: visitor.position.x, z: visitor.position.z };
    publishArea(rt.layout.rooms, here, last.current, session.setArea);

    const off = rig.offDefault;
    if (off !== last.current.offDefault) {
      last.current.offDefault = off;
      session.setCameraOffDefault(off);
    }

    publishReadiness(rt, last.current, mountedAt.current, session);

    // Photo download order: nearest by walking distance, re-ranked every 0.5 s (ADR 0005).
    timers.current.rank -= dt;
    if (timers.current.rank <= 0 && rt.photos.pendingCount > 0) {
      timers.current.rank = RANK_INTERVAL;
      const distances = new Map<string, number>();
      for (const slot of rt.layout.slots)
        distances.set(slot.photoId, rt.nav.pathLength(here, slot.standingSpot));
      rt.photos.rank(distances);
    }

    // Retry chip: a failed photo within 6 m (design spec 6.10).
    timers.current.failed -= dt;
    if (timers.current.failed <= 0) {
      timers.current.failed = FAILED_INTERVAL;
      let nearest: string | null = null;
      let best = 6;
      for (const slot of rt.layout.slots) {
        if (rt.photos.statusOf(slot.photoId) !== 'failed') continue;
        const d = dist2(here, slot.zonePoint);
        if (d < best) {
          best = d;
          nearest = slot.photoId;
        }
      }
      if (nearest !== last.current.nearFailed) {
        last.current.nearFailed = nearest;
        session.setNearFailedPhotoId(nearest);
      }
    }

    // Podium entered or left: edge-triggered, so the finale card cannot reappear after Keep
    // exploring until she has left the zone and come back.
    const finaleEdge = rt.finaleSignal.update(rt.director.intent);
    if (finaleEdge !== null) session.setFinaleReached(finaleEdge);

    // Hint glow ends after 6 s, and the UI's hint is cleared with it.
    if (rt.hint.target) last.current.hintShown = true;
    if (last.current.hintShown && rt.time > rt.hint.until) {
      last.current.hintShown = false;
      rt.hint.target = null;
      session.setHint(null);
    }

    // Screen rectangles for the caption card's placement rule, about every 100 ms.
    timers.current.rects -= dt;
    const guide = rt.registry.getSource('guide').read();
    const presenting = guide.presentation.kind !== 'none';
    if (presenting && timers.current.rects <= 0) {
      timers.current.rects = RECT_INTERVAL;
      timers.current.rectsLive = true;
      publishRects(
        rt,
        camera,
        gl.domElement,
        heights,
        guide.presentation,
        visitor.position,
        guide.position,
      );
    } else if (!presenting && timers.current.rectsLive) {
      timers.current.rectsLive = false;
      clearScreenRects();
    }
  }, -10);

  return null;
}

function publishArea(
  rooms: readonly Room[],
  p: Vec2,
  last: { areaKey: string },
  setArea: (area: { kind: Room['kind']; index: number; count: number } | null) => void,
): void {
  const room = roomOf(rooms, p);
  if (!room) return;
  const count = rooms.filter((r) => r.kind === 'gallery').length;
  const key = `${room.kind}:${room.galleryIndex}`;
  if (key === last.areaKey) return;
  last.areaKey = key;
  setArea({ kind: room.kind, index: room.galleryIndex, count });
}

function publishReadiness(
  rt: ReturnType<typeof useRuntime>,
  last: { progress: number; ready: boolean },
  mountedAt: number,
  session: ReturnType<typeof useSessionStore.getState>,
): void {
  // Ready (NFR-3): the entrance has rendered and the pictures nearest the spawn have settled,
  // or six seconds have passed, so a slow photo never holds the gallery back.
  const nearest = rt.layout.slots.slice(0, Math.min(3, rt.layout.slots.length));
  const settled = nearest.filter((s) => {
    const st = rt.photos.statusOf(s.photoId);
    return st === 'loaded' || st === 'failed';
  }).length;
  const fraction = nearest.length === 0 ? 1 : settled / nearest.length;
  const progress = Math.min(1, 0.2 + 0.8 * fraction);
  if (Math.abs(progress - last.progress) >= 0.05 || (progress === 1 && last.progress !== 1)) {
    last.progress = progress;
    session.setSceneProgress(progress);
  }
  const timedOut = performance.now() - mountedAt > READY_TIMEOUT * 1000;
  if (!last.ready && rt.rendered && (fraction >= 1 || timedOut)) {
    last.ready = true;
    session.setSceneProgress(1);
    session.setSceneReady(true);
  }
}

function publishRects(
  rt: ReturnType<typeof useRuntime>,
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  heights: { visitor: number; guide: number },
  presentation: { kind: string; photoId?: string },
  visitorPos: { x: number; z: number },
  guidePos: { x: number; z: number },
): void {
  const r = canvas.getBoundingClientRect();
  const area = { left: r.left, top: r.top, width: r.width, height: r.height };

  let picture = null;
  if (presentation.kind === 'photo') {
    const slot = rt.layout.slots.find((s) => s.photoId === presentation.photoId);
    if (slot) picture = projectPoints(frameCorners(slot), camera, area);
  }

  const labelRect = (role: 'visitor' | 'guide'): DOMRect | null => {
    const el = rt.labels.get(role);
    if (!el || Number(el.style.opacity || 0) < 0.05) return null;
    return el.getBoundingClientRect();
  };
  const actor = (role: 'visitor' | 'guide', pos: { x: number; z: number }) => {
    const body = projectPoints(characterCorners(pos.x, pos.z, heights[role]), camera, area);
    return unionRect(body, labelRect(role));
  };
  const visitor = actor('visitor', visitorPos);
  const guide = actor('guide', guidePos);
  publishScreenRects({ picture, visitor, guide });

  // If the two labels overlap on screen, raise the one farther from the camera by its own height
  // plus 4 px. The test uses where each label would be without the raise, so it does not flip.
  const lv = rt.labels.get('visitor');
  const lg = rt.labels.get('guide');
  if (lv && lg) {
    const cam = camera.position;
    const dv = Math.hypot(cam.x - visitorPos.x, cam.z - visitorPos.z);
    const dg = Math.hypot(cam.x - guidePos.x, cam.z - guidePos.z);
    const far = dv > dg ? lv : lg;
    const near = far === lv ? lg : lv;
    near.style.translate = '';
    near.dataset.raised = '0';
    const raisedBy = far.dataset.raised === '1' ? far.offsetHeight + 4 : 0;
    const a = near.getBoundingClientRect();
    const b = far.getBoundingClientRect();
    const bTop = b.top + raisedBy;
    const bBottom = b.bottom + raisedBy;
    const shown = Number(lv.style.opacity || 0) > 0.05 && Number(lg.style.opacity || 0) > 0.05;
    const overlap =
      shown && a.left < b.right && a.right > b.left && a.top < bBottom && a.bottom > bTop;
    far.dataset.raised = overlap ? '1' : '0';
    far.style.translate = overlap ? `0 -${far.offsetHeight + 4}px` : '';
  }
}
