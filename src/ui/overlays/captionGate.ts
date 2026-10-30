/**
 * When the caption card may appear (design spec 6.12 and its card timing note): after the
 * presentation camera settles, never later than 1.5 s after dwell completion. Pure, so the
 * waiting rules are unit-tested without a scene.
 *
 * The scene publishes `surprise-museum:presentation-camera` (docs/handoffs/scene-developer.md,
 * CR-2). It sends no event when framing never starts (solver fallback, finale), so a short grace
 * after the start covers that case: with no unsettled event seen by then, the card does not wait.
 */

export const CAMERA_EVENT = 'surprise-museum:presentation-camera';

/** Mirrors the 1.5 s card cap in design spec 6.12. Framing takes at most 1.45 s. */
export const CAPTION_CAP_MS = 1500;
/** Time allowed for the scene to announce `entering`; one or two frames plus margin. */
export const NO_FRAMING_GRACE_MS = 150;

export type CameraMode = 'follow' | 'entering' | 'framed' | 'returning' | 'cut';

export interface CameraSignal {
  mode: CameraMode;
  settled: boolean;
  photoId: string | null;
  seq: number;
}

export interface CaptionGate {
  photoId: string;
  /** Highest settled `seq` seen before this presentation began; an event at or below it is stale. */
  baselineSeq: number;
  startedAt: number;
  /** An unsettled event for this photo arrived, so a move is under way and the card waits for it. */
  framing: boolean;
  /** The camera has settled (framed or cut) for this presentation. */
  cameraSettled: boolean;
  /** `unknown` until the scene reports the Guide for this photo; then `walking` or `arrived`. */
  guide: 'unknown' | 'walking' | 'arrived';
  /** When the Guide arrived (ms on the gate's clock), once known. */
  guideArrivedAt: number | null;
  ready: boolean;
}

/**
 * The scene reports the Guide on `GUIDE_EVENT`: `arrived: false` when she starts walking to her
 * spot, `true` when she gets there. Until a report is seen the gate behaves as camera-only.
 */
export const GUIDE_EVENT = 'surprise-museum:guide-presenting';
/** Safety ceiling from dwell completion when the Guide never reports arrival. */
export const GUIDE_CEILING_MS = 6000;

export interface GuideSignal {
  photoId: string | null;
  arrived: boolean;
}

export function isGuideSignal(value: unknown): value is GuideSignal {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.arrived === 'boolean' && (v.photoId === null || typeof v.photoId === 'string');
}

export function startGate(photoId: string, baselineSeq: number, now: number): CaptionGate {
  return {
    photoId,
    baselineSeq,
    startedAt: now,
    framing: false,
    cameraSettled: false,
    guide: 'unknown',
    guideArrivedAt: null,
    ready: false,
  };
}

/** Ready once the camera has settled and the Guide has arrived (or is not being tracked). */
function resolve(gate: CaptionGate): CaptionGate {
  if (gate.ready) return gate;
  if (gate.cameraSettled && gate.guide !== 'walking') return { ...gate, ready: true };
  return gate;
}

export function applySignal(gate: CaptionGate, signal: CameraSignal): CaptionGate {
  if (gate.ready || signal.photoId !== gate.photoId) return gate;
  if (!signal.settled) return gate.framing ? gate : { ...gate, framing: true };
  const arrived = signal.mode === 'framed' || signal.mode === 'cut';
  if (arrived && signal.seq <= gate.baselineSeq) return gate; // from an earlier presentation
  return resolve({ ...gate, cameraSettled: true });
}

export function applyGuideSignal(gate: CaptionGate, signal: GuideSignal, now: number): CaptionGate {
  if (gate.ready || signal.photoId !== gate.photoId) return gate;
  if (signal.arrived) {
    if (gate.guide === 'arrived') return gate;
    return resolve({ ...gate, guide: 'arrived', guideArrivedAt: now });
  }
  return gate.guide === 'unknown' ? { ...gate, guide: 'walking' } : gate;
}

/**
 * When the 1.5 s cap runs out: counted from the later of dwell completion and the Guide's arrival
 * (tech-lead decision N-6). While the Guide is still walking the cap has not started, so only
 * the ceiling applies.
 */
function capAt(gate: CaptionGate): number {
  if (gate.guide === 'walking') return gate.startedAt + GUIDE_CEILING_MS;
  return Math.max(gate.startedAt, gate.guideArrivedAt ?? gate.startedAt) + CAPTION_CAP_MS;
}

/** Applies the grace and the cap. Call on a timer; it is cheap and idempotent. */
export function tickGate(gate: CaptionGate, now: number): CaptionGate {
  if (gate.ready) return gate;
  if (now >= capAt(gate)) return { ...gate, ready: true };
  const elapsed = now - gate.startedAt;
  if (!gate.framing && elapsed >= NO_FRAMING_GRACE_MS) {
    return resolve({ ...gate, cameraSettled: true });
  }
  return gate;
}

/** Milliseconds until `tickGate` could next change the answer; null when already ready. */
export function nextCheckInMs(gate: CaptionGate, now: number): number | null {
  if (gate.ready) return null;
  const cap = capAt(gate) - now;
  if (gate.framing) return Math.max(0, cap);
  return Math.max(0, Math.min(cap, gate.startedAt + NO_FRAMING_GRACE_MS - now));
}

export function isCameraSignal(value: unknown): value is CameraSignal {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.mode === 'string' &&
    typeof v.settled === 'boolean' &&
    typeof v.seq === 'number' &&
    (v.photoId === null || typeof v.photoId === 'string')
  );
}
