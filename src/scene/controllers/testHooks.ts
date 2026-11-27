import type { WebGLRenderer } from 'three';
import { useMuseumStore } from '@/state/museumStore';
import { useSessionStore } from '@/state/sessionStore';
import type { FollowCameraRig } from '../cameras/FollowCameraRig';
import type {
  PresentationCameraController,
  PresentationCameraSnapshot,
} from '../cameras/PresentationCameraController';
import type { ScreenRect } from '@/state/screenRects';
import { avatarHeight } from '../characters/avatarRig';
import { computePictureVisibleFraction } from './framingRects';
import { headCorners, projectPoints } from './projection';
import type { SceneRuntime } from '../runtime/SceneRuntime';
import { jumpTo, replay } from './actions';

/**
 * Playwright test hooks. Convention: `window.__surpriseMuseum`. They exist only in a development
 * or test-mode build (C-11): a production build never installs them, whatever the URL or window
 * flags say. Inside a test-mode build the page must also opt in:
 *   - tests call `page.addInitScript(() => { window.__SURPRISE_E2E__ = true; })`, or
 *   - the URL has `?e2e=1` before the hash.
 * The Vite dev server installs them without an opt-in.
 * Everything is read-only except the explicit actions below. Positions are plan metres (x, z);
 * headings are radians (0 faces +Z, PI faces down the route).
 */
export interface MuseumTestHooks {
  /** Whole-scene snapshot, cheap enough to poll. */
  snapshot(): TestSnapshot;
  /** Cut the Visitor to a point (a test shortcut, not a game feature). */
  teleportVisitor(x: number, z: number, heading?: number): void;
  /** Walk the Visitor to a point with real movement and collision. Resolves when she arrives. */
  walkVisitorTo(x: number, z: number, timeoutMs?: number): Promise<boolean>;
  cancelWalk(): void;
  /** Stand the Visitor at a picture's standing spot (0-based index) or on the podium. */
  standAtPhoto(index: number): boolean;
  standAtFinale(): void;
  replay(): void;
  /** Make a photo fail until retried, to test the failed state and retry. */
  failPhoto(photoId: string): void;
  retryPhoto(photoId: string): void;
  /** Picture positions and zones, to compute where to walk. */
  layout(): TestLayout;
  /**
   * Each character's projected head box in CSS pixels, viewport coordinates (FR-111); null when
   * the head is off screen or the character is not drawn. Read the label boxes from the DOM.
   */
  headBoxes(): { visitor: ScreenRect | null; guide: ScreenRect | null };
}

export interface TestSnapshot {
  ready: boolean;
  time: number;
  visitor: TestCharacter;
  guide: TestCharacter & { mode: string; opacity: number; gesture: string };
  intent: string;
  dwell: { photoId: string | null; progress: number };
  finaleReached: boolean;
  photoStatus: Record<string, string>;
  camera: { x: number; y: number; z: number; yaw: number; pitch: number; offDefault: boolean };
  render: {
    calls: number;
    triangles: number;
    textures: number;
    geometries: number;
    programs: number;
    /** Resident wall photo textures and their estimated GPU bytes (including mipmaps). */
    photoTextures: number;
    photoTextureBytes: number;
  };
  labels: { visitor: boolean; guide: boolean };
  /** The presentation camera (design spec 6.12.9 QA hook). */
  presentationCamera: PresentationCameraSnapshot;
  /** Opacity of each internal wall; below 1 means it is fading because it blocks the camera. */
  partitionOpacity: number[];
  /**
   * Opacity of the ceiling (design spec 6.3): 1 at the default view, falling to 0 as the camera
   * rises to within 0.1 m of it (1 - smoothstep(H - 0.6, H - 0.1, camera y); under reduced motion
   * a hard step, off above H - 0.35 and on below H - 0.55). 0 means it is not drawn.
   */
  ceilingOpacity: number;
  /** The graphics tier in use: 'low' or 'high'. */
  quality: string | null;
}
export interface TestCharacter {
  x: number;
  z: number;
  heading: number;
  speed: number;
  locomotion: string;
  presentation: string;
  teleportSeq: number;
}
export interface TestLayout {
  rooms: Array<{ kind: string; minZ: number; maxZ: number }>;
  slots: Array<{
    photoId: string;
    index: number;
    zone: { x: number; z: number };
    standingSpot: { x: number; z: number };
    wall: string;
  }>;
  finale: { x: number; z: number; triggerRadius: number };
  spawn: { x: number; z: number };
}

declare global {
  interface Window {
    __SURPRISE_E2E__?: boolean;
    __surpriseMuseum?: MuseumTestHooks;
  }
}

/**
 * The build gate comes first and is written as plain `import.meta.env` reads so the bundler
 * replaces it with `false` in a production build (C-11). The opt-ins only apply inside it.
 */
export function testHooksEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (!(import.meta.env.DEV || import.meta.env.MODE === 'test')) return false;
  return (
    import.meta.env.DEV ||
    window.__SURPRISE_E2E__ === true ||
    new URLSearchParams(window.location.search).get('e2e') === '1'
  );
}

export function installTestHooks(
  runtime: SceneRuntime,
  rig: FollowCameraRig,
  gl: WebGLRenderer,
  presenter: PresentationCameraController,
): () => void {
  // Literal build gate first, so a production build drops the hook code (C-11).
  if (!(import.meta.env.DEV || import.meta.env.MODE === 'test')) return () => undefined;
  if (!testHooksEnabled()) return () => undefined;

  const describe = (role: 'visitor' | 'guide'): TestCharacter => {
    const s = runtime.registry.getSource(role).read();
    const p = s.presentation;
    return {
      x: s.position.x,
      z: s.position.z,
      heading: s.heading,
      speed: s.speed,
      locomotion: s.locomotion,
      presentation: p.kind === 'photo' ? `photo:${p.photoId}` : p.kind,
      teleportSeq: s.teleportSeq,
    };
  };

  const hooks: MuseumTestHooks = {
    snapshot() {
      const g = runtime.registry.getSource('guide').read();
      const intent = runtime.director.intent;
      const status: Record<string, string> = {};
      for (const slot of runtime.layout.slots)
        status[slot.photoId] = runtime.photos.statusOf(slot.photoId);
      return {
        ready: useSessionStore.getState().sceneReady,
        time: runtime.time,
        visitor: describe('visitor'),
        guide: {
          ...describe('guide'),
          mode: runtime.guide.currentMode,
          opacity: g.opacity,
          gesture: g.gesture,
        },
        intent: intent.kind === 'photo' ? `photo:${intent.photoId}` : intent.kind,
        dwell: runtime.director.dwell,
        finaleReached: runtime.director.finaleReached,
        photoStatus: status,
        camera: {
          ...rig.pose.position,
          yaw: rig.yaw,
          pitch: rig.pitch,
          offDefault: rig.offDefault,
        },
        render: {
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          textures: gl.info.memory.textures,
          geometries: gl.info.memory.geometries,
          programs: gl.info.programs?.length ?? 0,
          photoTextures: runtime.photos.residentStats().count,
          photoTextureBytes: runtime.photos.residentStats().bytes,
        },
        presentationCamera: {
          ...presenter.snapshot,
          pictureVisibleFraction: computePictureVisibleFraction(
            runtime,
            presenter.camera,
            gl.domElement,
            presenter.snapshot.photoId,
          ),
        },
        partitionOpacity: [...runtime.partitionOpacity],
        ceilingOpacity: runtime.ceilingOpacity,
        quality: document.documentElement.dataset.graphicsQuality ?? null,
        labels: {
          visitor: Number(runtime.labels.get('visitor')?.style.opacity ?? 0) > 0.5,
          guide: Number(runtime.labels.get('guide')?.style.opacity ?? 0) > 0.5,
        },
      };
    },
    teleportVisitor(x, z, heading) {
      const h = heading ?? runtime.registry.getSource('visitor').read().heading;
      runtime.director.reset();
      runtime.finaleSignal.reset();
      runtime.visitor.teleport({ x, y: 0, z }, h);
    },
    walkVisitorTo(x, z, timeoutMs = 60_000) {
      runtime.autopilot.target = { x, z };
      return new Promise<boolean>((resolve) => {
        const start = performance.now();
        const tick = () => {
          if (!runtime.autopilot.target) return resolve(true);
          if (performance.now() - start > timeoutMs) {
            runtime.autopilot.target = null;
            return resolve(false);
          }
          requestAnimationFrame(tick);
        };
        tick();
      });
    },
    cancelWalk() {
      runtime.autopilot.target = null;
    },
    standAtPhoto(index) {
      const slot = runtime.layout.slots[index];
      return slot ? jumpTo(runtime, rig, { kind: 'photo', photoId: slot.photoId }) : false;
    },
    standAtFinale() {
      jumpTo(runtime, rig, { kind: 'finale' });
    },
    replay() {
      replay(runtime, rig);
    },
    failPhoto(photoId) {
      runtime.photos.forceFailure(photoId);
    },
    retryPhoto(photoId) {
      runtime.photos.retry(photoId);
      useMuseumStore.getState().setPhotoStatus(photoId, 'loading');
    },
    headBoxes() {
      const camera = presenter.camera;
      const box = gl.domElement.getBoundingClientRect();
      const area = { left: box.left, top: box.top, width: box.width, height: box.height };
      const head = (role: 'visitor' | 'guide'): ScreenRect | null => {
        const s = runtime.registry.getSource(role).read();
        if (!camera || s.opacity <= 0.05) return null;
        const height = avatarHeight(
          role === 'visitor' ? runtime.content.visitorAvatar : runtime.content.guideAvatar,
        );
        return projectPoints(headCorners(s.position.x, s.position.z, height, camera), camera, area);
      };
      return { visitor: head('visitor'), guide: head('guide') };
    },
    layout() {
      const l = runtime.layout;
      return {
        rooms: l.rooms.map((r) => ({ kind: r.kind, minZ: r.bounds.minZ, maxZ: r.bounds.maxZ })),
        slots: l.slots.map((s) => ({
          photoId: s.photoId,
          index: s.index,
          zone: { ...s.zonePoint },
          standingSpot: { ...s.standingSpot },
          wall: s.wall,
        })),
        finale: { ...l.finale.center, triggerRadius: l.finale.triggerRadius },
        spawn: { ...l.spawn.visitor.position },
      };
    },
  };
  window.__surpriseMuseum = hooks;
  return () => {
    if (window.__surpriseMuseum === hooks) delete window.__surpriseMuseum;
  };
}
