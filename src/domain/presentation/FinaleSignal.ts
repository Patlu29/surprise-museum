import type { PresentationIntent } from './PresentationDirector';

/**
 * Edge-triggered "the Visitor is on the podium" signal for the UI (`sessionStore.finaleReached`).
 * It follows the director's finale intent, so it inherits the director's suppression: after
 * Keep exploring the intent stays off until she has left the podium zone (trigger radius + 1 m)
 * and entered it again, and the signal does not come back to true before then.
 *
 * `update` returns true on entering, false on leaving, and null when nothing changed, so the
 * caller writes to the store only on an edge. Call `reset` after a replay or a jump (the
 * director has been reset too), so a Visitor placed on the podium is reported as entering.
 */
export class FinaleSignal {
  private inside = false;

  update(intent: PresentationIntent): boolean | null {
    const now = intent.kind === 'finale';
    if (now === this.inside) return null;
    this.inside = now;
    return now;
  }

  reset(): void {
    this.inside = false;
  }
}
