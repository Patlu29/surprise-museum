import type { MuseumLayout, PhotoSlot } from '../layout/types';
import { dist2, dot2, type Vec2 } from '../math/vec2';
import { segmentClear } from '../navigation/geometry';

/**
 * What the Guide should be presenting right now (FR-26 to FR-29). The director decides this from
 * the Visitor's position alone; the Guide decides how to act on it.
 */
export type PresentationIntent =
  | { readonly kind: 'none' }
  | { readonly kind: 'photo'; readonly photoId: string; readonly slotIndex: number }
  | { readonly kind: 'finale' };

export interface DirectorConfig {
  /** Enter a picture's zone within this distance (m). FR-26. */
  enterDistance: number;
  /** A presentation ends beyond this distance (m). FR-27. */
  exitDistance: number;
  /** The nearest candidate must stay nearest this long (s). FR-26. */
  dwellSeconds: number;
  /** The Visitor must be at least this far in front of the wall plane to count as same side (m). */
  sameSideMargin: number;
  /** The finale ends this far beyond its trigger radius (m). */
  finaleExitMargin: number;
}

export const DEFAULT_DIRECTOR_CONFIG: Readonly<DirectorConfig> = {
  enterDistance: 3,
  exitDistance: 4.5,
  dwellSeconds: 1,
  sameSideMargin: 0.2,
  finaleExitMargin: 1,
};

const NONE: PresentationIntent = Object.freeze({ kind: 'none' });
const FINALE: PresentationIntent = Object.freeze({ kind: 'finale' });

/**
 * Pure state machine, updated once per frame (architecture 6.4).
 *
 * - Candidates: zones within 3 m, on the same side of the wall, with a clear line of sight.
 * - Dwell: the nearest candidate must stay nearest for 1 s. The timer resets if the nearest
 *   candidate changes or disappears, so walking past starts nothing (FR-28).
 * - Exit: the active photo ends past 4.5 m, or when the Visitor is behind the wall plane or the
 *   zone is hidden behind a wall. The gap between 3 m and 4.5 m prevents flicker (FR-27).
 * - Switch: during a presentation a different nearest candidate that completes its own dwell
 *   replaces it. Nothing is queued.
 * - Dismiss: ends the presentation and suppresses that photo until the Visitor goes beyond the
 *   exit distance (A-19).
 * - Finale: entering the podium zone starts it at once; leaving past trigger radius + 1 m ends it.
 */
export class PresentationDirector {
  private readonly cfg: DirectorConfig;
  private current: PresentationIntent = NONE;
  private dwellId: string | null = null;
  private dwellTime = 0;
  private readonly suppressed = new Set<string>();
  private finaleSuppressed = false;
  private finaleEverReached = false;

  private readonly layout: MuseumLayout;

  constructor(layout: MuseumLayout, config: Partial<DirectorConfig> = {}) {
    this.layout = layout;
    this.cfg = { ...DEFAULT_DIRECTOR_CONFIG, ...config };
  }

  get intent(): PresentationIntent {
    return this.current;
  }

  /** The photo the Visitor is dwelling beside, with progress 0 to 1 (drives the floor pool). */
  get dwell(): { photoId: string | null; progress: number } {
    return {
      photoId: this.dwellId,
      progress: this.dwellId ? Math.min(1, this.dwellTime / this.cfg.dwellSeconds) : 0,
    };
  }

  /** True once the Visitor has ever stepped onto the podium (published as finale-reached). */
  get finaleReached(): boolean {
    return this.finaleEverReached;
  }

  /** Dismiss the active presentation and suppress it until the Visitor leaves its zone. */
  dismiss(): void {
    if (this.current.kind === 'photo') this.suppressed.add(this.current.photoId);
    else if (this.current.kind === 'finale') this.finaleSuppressed = true;
    this.current = NONE;
    this.resetDwell();
  }

  /** Back to a clean slate (replay and jump-to-photo). */
  reset(keepFinaleReached = true): void {
    this.current = NONE;
    this.resetDwell();
    this.suppressed.clear();
    this.finaleSuppressed = false;
    if (!keepFinaleReached) this.finaleEverReached = false;
  }

  /** Advance by dt seconds with the Visitor's floor position. Returns the intent. */
  update(dt: number, visitor: Vec2): PresentationIntent {
    this.releaseSuppression(visitor);

    // ---- Finale takes precedence: it has its own room, so zones never overlap in practice. ----
    const dFinale = dist2(visitor, this.layout.finale.center);
    if (this.current.kind === 'finale') {
      if (dFinale > this.layout.finale.triggerRadius + this.cfg.finaleExitMargin) {
        this.current = NONE;
      } else {
        this.resetDwell();
        return this.current;
      }
    } else if (!this.finaleSuppressed && dFinale <= this.layout.finale.triggerRadius) {
      this.current = FINALE;
      this.finaleEverReached = true;
      this.resetDwell();
      return this.current;
    }

    // ---- Photos --------------------------------------------------------------------------------
    if (this.current.kind === 'photo') {
      const slot = this.layout.slots[this.current.slotIndex];
      if (!slot || !this.stillPresentable(slot, visitor)) {
        this.current = NONE;
      }
    }

    const nearest = this.nearestCandidate(visitor);
    const activeId = this.current.kind === 'photo' ? this.current.photoId : null;

    if (!nearest || nearest.photoId === activeId) {
      this.resetDwell();
      return this.current;
    }

    if (this.dwellId !== nearest.photoId) {
      this.dwellId = nearest.photoId;
      this.dwellTime = 0;
    } else {
      this.dwellTime += dt;
    }
    if (this.dwellTime >= this.cfg.dwellSeconds) {
      this.current = { kind: 'photo', photoId: nearest.photoId, slotIndex: nearest.index };
      this.resetDwell();
    }
    return this.current;
  }

  // ---- Internals ---------------------------------------------------------------------------

  private resetDwell(): void {
    this.dwellId = null;
    this.dwellTime = 0;
  }

  /** Suppressed photos become presentable again once the Visitor is beyond the exit distance. */
  private releaseSuppression(visitor: Vec2): void {
    if (this.finaleSuppressed) {
      const d = dist2(visitor, this.layout.finale.center);
      if (d > this.layout.finale.triggerRadius + this.cfg.finaleExitMargin) {
        this.finaleSuppressed = false;
      }
    }
    if (this.suppressed.size === 0) return;
    for (const id of this.suppressed) {
      const slot = this.layout.slots.find((s) => s.photoId === id);
      if (!slot || dist2(visitor, slot.zonePoint) > this.cfg.exitDistance) {
        this.suppressed.delete(id);
      }
    }
  }

  private sameSide(slot: PhotoSlot, visitor: Vec2): boolean {
    // Measured from the wall surface (the picture's position), not from the zone point that sits
    // 0.3 m in front of it. Characters stop 0.3 m from the wall, so measuring from the zone point
    // would make a Visitor standing right at the picture count as "behind" it.
    return (
      dot2(slot.normal, { x: visitor.x - slot.position.x, z: visitor.z - slot.position.z }) >
      this.cfg.sameSideMargin
    );
  }

  private visible(slot: PhotoSlot, visitor: Vec2): boolean {
    return segmentClear(visitor, slot.zonePoint, this.layout.colliders, 0);
  }

  private stillPresentable(slot: PhotoSlot, visitor: Vec2): boolean {
    return (
      dist2(visitor, slot.zonePoint) <= this.cfg.exitDistance &&
      this.sameSide(slot, visitor) &&
      this.visible(slot, visitor)
    );
  }

  private nearestCandidate(visitor: Vec2): PhotoSlot | null {
    let best: PhotoSlot | null = null;
    let bestD = Infinity;
    for (const slot of this.layout.slots) {
      if (this.suppressed.has(slot.photoId)) continue;
      const d = dist2(visitor, slot.zonePoint);
      if (d > this.cfg.enterDistance || d >= bestD) continue;
      if (!this.sameSide(slot, visitor) || !this.visible(slot, visitor)) continue;
      best = slot;
      bestD = d;
    }
    return best;
  }
}
