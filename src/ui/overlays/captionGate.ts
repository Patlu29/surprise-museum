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
  ready: boolean;
}

export function startGate(photoId: string, baselineSeq: number, now: number): CaptionGate {
  return { photoId, baselineSeq, startedAt: now, framing: false, ready: false };
}

export function applySignal(gate: CaptionGate, signal: CameraSignal): CaptionGate {
  if (gate.ready || signal.photoId !== gate.photoId) return gate;
  if (!signal.settled) return gate.framing ? gate : { ...gate, framing: true };
  const arrived = signal.mode === 'framed' || signal.mode === 'cut';
  if (arrived && signal.seq <= gate.baselineSeq) return gate; // from an earlier presentation
  return { ...gate, ready: true };
}

/** Applies the grace and the cap. Call on a timer; it is cheap and idempotent. */
export function tickGate(gate: CaptionGate, now: number): CaptionGate {
  if (gate.ready) return gate;
  const elapsed = now - gate.startedAt;
  if (elapsed >= CAPTION_CAP_MS) return { ...gate, ready: true };
  if (!gate.framing && elapsed >= NO_FRAMING_GRACE_MS) return { ...gate, ready: true };
  return gate;
}

/** Milliseconds until `tickGate` could next change the answer; null when already ready. */
export function nextCheckInMs(gate: CaptionGate, now: number): number | null {
  if (gate.ready) return null;
  const elapsed = now - gate.startedAt;
  const target = gate.framing ? CAPTION_CAP_MS : NO_FRAMING_GRACE_MS;
  return Math.max(0, target - elapsed);
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
