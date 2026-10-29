import type { MuseumContent } from '@contract';
import { CharacterRegistryImpl } from '@/domain/characters/CharacterRegistryImpl';
import type { MoveIntent } from '@/domain/characters/characterState';
import { LocalVisitorController } from '@/domain/characters/LocalVisitorController';
import { AutonomousGuideSource, type GuideViewInfo } from '@/domain/guide/AutonomousGuideSource';
import { generateLayout } from '@/domain/layout/generateLayout';
import type { MuseumLayout } from '@/domain/layout/types';
import type { Vec2 } from '@/domain/math/vec2';
import { NavGraph } from '@/domain/navigation/navGraph';
import { FinaleSignal } from '@/domain/presentation/FinaleSignal';
import { PresentationDirector } from '@/domain/presentation/PresentationDirector';
import { inputState } from '@/state/inputState';
import { useSessionStore } from '@/state/sessionStore';
import { PhotoTextures } from '../photos/PhotoTextures';

/** The stable set of collaborators for one museum session. Built once per `content`. */
export interface SceneRuntime {
  content: MuseumContent;
  layout: MuseumLayout;
  nav: NavGraph;
  director: PresentationDirector;
  registry: CharacterRegistryImpl;
  visitor: LocalVisitorController;
  guide: AutonomousGuideSource;
  photos: PhotoTextures;
  /** Camera field of view for the Guide's "stay on screen" preference. Updated on resize. */
  view: GuideViewInfo;
  /** Name label elements, registered by <NameLabel>, for overlap handling and screen rects. */
  labels: Map<'visitor' | 'guide', HTMLElement>;
  /** Test and tooling hook: walk the Visitor to a point as if input were held. */
  autopilot: { target: Vec2 | null; intent: MoveIntent };
  /** Edge-triggered podium signal for sessionStore.finaleReached. */
  finaleSignal: FinaleSignal;
  /** Current opacity of each internal wall (1 opaque, about 0.25 while it blocks the camera). */
  partitionOpacity: number[];
  /** Index of the picture under the mouse (desktop hover), or -1. */
  hoverIndex: number;
  /** Frame glow requested by the hint control (design spec 5.11). */
  hint: { target: string | null; until: number };
  /** Seconds since the session started. */
  time: number;
  /** True once the first frame has rendered. */
  rendered: boolean;
  dispose(): void;
}

export interface RuntimeOptions {
  content: MuseumContent;
  anisotropy: number;
  /** Longest texture edge for wall photos right now (changes with the graphics tier). */
  photoMaxEdge: () => number;
  onPhotoStatus: (id: string, status: 'placeholder' | 'loading' | 'loaded' | 'failed') => void;
  onUrlsExpired: () => void;
}

/** True while input must be ignored: the welcome screen, or the full-screen viewer (design 5.8). */
export function isInputBlocked(): boolean {
  const s = useSessionStore.getState();
  return s.phase !== 'roaming' || s.viewerPhotoId !== null;
}

export function createSceneRuntime(options: RuntimeOptions): SceneRuntime {
  const { content } = options;
  const ordered = [...content.photos].sort((a, b) => a.position - b.position);
  const layout = generateLayout(
    ordered.map((p) => ({ id: p.id, width: p.width, height: p.height })),
  );
  const nav = new NavGraph(layout);
  const director = new PresentationDirector(layout);
  const registry = new CharacterRegistryImpl();

  const view: GuideViewInfo = { fovY: (55 * Math.PI) / 180, aspect: 16 / 9 };
  const autopilot: { target: Vec2 | null; intent: MoveIntent } = {
    target: null,
    intent: { x: 0, y: 0 },
  };
  const merged: MoveIntent = { x: 0, y: 0 };

  const visitor = new LocalVisitorController({
    layout,
    // The UI eases keyboard input itself (src/hooks/keyboardIntent) and the joystick scales
    // linearly, so the controller must not ease a second time.
    accelerationTau: 0,
    readIntent: () => {
      merged.x = 0;
      merged.y = 0;
      if (isInputBlocked()) return merged;
      const src = autopilot.target ? autopilot.intent : inputState.move;
      merged.x = src.x;
      merged.y = src.y;
      return merged;
    },
  });
  const guide = new AutonomousGuideSource({ layout, nav, director, getView: () => view });

  registry.setSource('visitor', visitor);
  registry.setSource('guide', guide);

  const photos = new PhotoTextures({
    anisotropy: options.anisotropy,
    maxEdge: options.photoMaxEdge,
    onStatus: options.onPhotoStatus,
    onUrlsExpired: options.onUrlsExpired,
  });
  photos.add(ordered.map((p) => ({ id: p.id, wallUrl: p.wallUrl, lqip: p.lqip })));

  const rt: SceneRuntime = {
    content,
    layout,
    nav,
    director,
    registry,
    visitor,
    guide,
    photos,
    view,
    labels: new Map(),
    autopilot,
    finaleSignal: new FinaleSignal(),
    partitionOpacity: layout.partitions.map(() => 1),
    hoverIndex: -1,
    hint: { target: null, until: 0 },
    time: 0,
    rendered: false,
    dispose() {
      photos.dispose();
      registry.dispose();
      rt.labels.clear();
    },
  };
  return rt;
}
