import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Presentation } from '@/domain/characters/characterState';

/**
 * The Visitor's session: the bridge between the DOM overlay and the 3D scene.
 *
 * WHO WRITES WHAT
 *   Scene -> UI (the scene calls these actions; the UI renders from the fields):
 *     setSceneProgress(p)       0..1 while assets load (the UI cannot use drei's useProgress)
 *     setSceneReady(true)       once the entrance and the nearest photos have rendered (NFR-3)
 *     setPresentation(p)        when the Guide's `presentation` changes (registry callback).
 *                               A 'photo' presentation also marks that photo as viewed (A-17)
 *     openViewer(photoId)       when the Visitor taps a picture (R3F onClick); marks it viewed
 *     setContextLost(true)      on `webglcontextlost` (NFR-11)
 *     setArea(area)             when the Visitor enters another room (live-region announcement)
 *     setCameraOffDefault(b)    true once the camera is >20 degrees (or boom) from default
 *     setHint(hint)             answer to a hint request (edge arrow + announcement)
 *     setNearFailedPhotoId(id)  a failed photo within 6 m, for the DOM Retry chip
 *     setFinaleReached(b)       true when the Visitor steps onto the podium (FR-29); false when she
 *                               leaves it (past r + 1 m), replays or jumps. The finale card shows
 *                               while this is true. Keep exploring clears it and sends `dismissSeq`
 *
 *   UI -> Scene (command counters: the UI increments, the scene reacts when the number changes;
 *   read them with `useSessionStore.subscribe(selector, listener)` or `getState()` in useFrame):
 *     dismissSeq   Close on the caption card, Keep exploring, Escape or Enter on the canvas.
 *                  End the current presentation and suppress that picture until the Visitor is
 *                  past 4.5 m (A-19). For the finale, suppress until r + 1 m.
 *     replaySeq    Replay: teleport Visitor and Guide to the entrance, reset the camera behind
 *                  the Visitor. The UI has already cleared `viewed` and the veil hides the cut.
 *     jump         `{ target, seq }`: stand the Visitor in front of that picture (or on the
 *                  finale), teleport the Guide beside her, snap the camera behind her facing the
 *                  picture. Then start the presentation as usual. Behind a veil.
 *     resetViewSeq Return the camera to behind the Visitor at default pitch and boom.
 *     hintSeq      Compute the nearest unviewed picture (or the finale when all are viewed),
 *                  glow its frame and call setHint().
 *
 *   Scene reads (never writes): `phase` (pause input and Guide while 'welcome'), `viewerPhotoId`
 *   (pause rendering and ignore input while not null), `viewed`.
 */

export type SessionPhase = 'welcome' | 'roaming';

export type JumpTarget = { kind: 'photo'; photoId: string } | { kind: 'finale' };

export interface AreaInfo {
  kind: 'entrance' | 'gallery' | 'finale';
  /** 1-based gallery number for galleries, 0 otherwise. */
  index: number;
  /** Number of galleries. */
  count: number;
}

export interface HintInfo {
  target: { kind: 'photo'; photoId: string } | { kind: 'finale' };
  /** Screen direction to the target in degrees: 0 up, 90 right, 180 down, 270 left. */
  bearingDeg: number;
  distanceM: number;
  /** True when the target is already visible, so no edge arrow is needed. */
  onScreen: boolean;
}

export interface SessionState {
  phase: SessionPhase;
  sceneReady: boolean;
  /** 0..1, or null when the scene has not published progress. */
  sceneProgress: number | null;
  presentation: Presentation;
  viewed: ReadonlySet<string>;
  viewerPhotoId: string | null;
  contextLost: boolean;
  area: AreaInfo | null;
  cameraOffDefault: boolean;
  hint: HintInfo | null;
  nearFailedPhotoId: string | null;
  /** True while the Visitor is on the finale podium. The finale card keys off this (or a 'finale' presentation). */
  finaleReached: boolean;

  dismissSeq: number;
  replaySeq: number;
  resetViewSeq: number;
  hintSeq: number;
  jump: { target: JumpTarget; seq: number } | null;

  start: () => void;
  setSceneReady: (ready: boolean) => void;
  setSceneProgress: (progress: number | null) => void;
  setPresentation: (presentation: Presentation) => void;
  markViewed: (photoId: string) => void;
  openViewer: (photoId: string) => void;
  closeViewer: () => void;
  setContextLost: (lost: boolean) => void;
  setArea: (area: AreaInfo | null) => void;
  setCameraOffDefault: (off: boolean) => void;
  setHint: (hint: HintInfo | null) => void;
  setNearFailedPhotoId: (photoId: string | null) => void;
  setFinaleReached: (reached: boolean) => void;

  dismissPresentation: () => void;
  replay: () => void;
  requestJump: (target: JumpTarget) => void;
  resetView: () => void;
  requestHint: () => void;
  /** Back to a fresh session (new museum, leaving the screen). */
  reset: () => void;
}

export function samePresentation(a: Presentation, b: Presentation): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'photo' && b.kind === 'photo') return a.photoId === b.photoId;
  return true;
}

function initialValues() {
  return {
    phase: 'welcome' as SessionPhase,
    sceneReady: false,
    sceneProgress: null as number | null,
    presentation: { kind: 'none' } as Presentation,
    viewed: new Set<string>() as ReadonlySet<string>,
    viewerPhotoId: null as string | null,
    contextLost: false,
    area: null as AreaInfo | null,
    cameraOffDefault: false,
    hint: null as HintInfo | null,
    nearFailedPhotoId: null as string | null,
    finaleReached: false,
    dismissSeq: 0,
    replaySeq: 0,
    resetViewSeq: 0,
    hintSeq: 0,
    jump: null as { target: JumpTarget; seq: number } | null,
  };
}

function withViewed(viewed: ReadonlySet<string>, photoId: string): ReadonlySet<string> {
  if (viewed.has(photoId)) return viewed;
  const next = new Set(viewed);
  next.add(photoId);
  return next;
}

export const useSessionStore = create<SessionState>()(
  subscribeWithSelector((set) => ({
    ...initialValues(),

    start: () => set({ phase: 'roaming' }),
    setSceneReady: (sceneReady) => set({ sceneReady }),
    setSceneProgress: (sceneProgress) =>
      set({
        sceneProgress: sceneProgress === null ? null : Math.max(0, Math.min(1, sceneProgress)),
      }),

    setPresentation: (presentation) =>
      set((state) => {
        if (samePresentation(state.presentation, presentation)) return state;
        return presentation.kind === 'photo'
          ? { presentation, viewed: withViewed(state.viewed, presentation.photoId) }
          : { presentation };
      }),

    markViewed: (photoId) => set((state) => ({ viewed: withViewed(state.viewed, photoId) })),

    openViewer: (photoId) =>
      set((state) => ({ viewerPhotoId: photoId, viewed: withViewed(state.viewed, photoId) })),
    closeViewer: () => set({ viewerPhotoId: null }),

    setContextLost: (contextLost) => set({ contextLost }),
    setArea: (area) =>
      set((state) => {
        const prev = state.area;
        if (prev === area) return state;
        if (
          prev &&
          area &&
          prev.kind === area.kind &&
          prev.index === area.index &&
          prev.count === area.count
        ) {
          return state;
        }
        return { area };
      }),
    setCameraOffDefault: (cameraOffDefault) => set({ cameraOffDefault }),
    setHint: (hint) => set({ hint }),
    setNearFailedPhotoId: (nearFailedPhotoId) => set({ nearFailedPhotoId }),
    setFinaleReached: (finaleReached) => set({ finaleReached }),

    dismissPresentation: () =>
      set((state) => ({
        dismissSeq: state.dismissSeq + 1,
        presentation: { kind: 'none' },
        finaleReached: false,
      })),

    replay: () =>
      set((state) => ({
        replaySeq: state.replaySeq + 1,
        viewed: new Set<string>(),
        presentation: { kind: 'none' },
        viewerPhotoId: null,
        hint: null,
        finaleReached: false,
      })),

    requestJump: (target) =>
      set((state) => ({
        jump: { target, seq: (state.jump?.seq ?? 0) + 1 },
        presentation: { kind: 'none' },
        hint: null,
        finaleReached: false,
      })),

    resetView: () =>
      set((state) => ({ resetViewSeq: state.resetViewSeq + 1, cameraOffDefault: false })),
    requestHint: () => set((state) => ({ hintSeq: state.hintSeq + 1 })),

    reset: () => set(initialValues()),
  })),
);
