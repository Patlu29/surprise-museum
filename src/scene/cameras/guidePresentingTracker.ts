/**
 * Tells the caption card when the Guide starts walking to a presentation spot and when she gets
 * there (event `surprise-museum:guide-presenting`, N-6: the card's cap runs from the later of
 * dwell completion and the Guide's arrival). Pure, so the ordering rules are unit-tested.
 *
 * - `arrived: false` once per presentation, when the director's intent becomes that photo.
 * - `arrived: true` once, when the Guide's mode becomes `present` (she is on the spot, or the
 *   1.5 s walking cap passed, or reduced motion put her there at once).
 * - A cancelled or replaced presentation sends nothing further for the old photo.
 */
export const GUIDE_PRESENTING_EVENT = 'surprise-museum:guide-presenting';

export interface GuidePresentingDetail {
  photoId: string;
  arrived: boolean;
}

export class GuidePresentingTracker {
  private photoId: string | null = null;
  private arrived = false;
  private last: GuidePresentingDetail | null = null;

  /** The most recent state, for the QA snapshot; null when no photo is being presented. */
  get state(): Readonly<GuidePresentingDetail> | null {
    return this.photoId === null ? null : { photoId: this.photoId, arrived: this.arrived };
  }

  /** Call every frame. Returns the events to dispatch now, in order (usually none). */
  update(photoId: string | null, guideMode: string): GuidePresentingDetail[] {
    const out: GuidePresentingDetail[] = [];
    if (photoId !== this.photoId) {
      this.photoId = photoId;
      this.arrived = false;
      if (photoId !== null) out.push({ photoId, arrived: false });
    }
    if (this.photoId !== null && !this.arrived && guideMode === 'present') {
      this.arrived = true;
      out.push({ photoId: this.photoId, arrived: true });
    }
    if (out.length > 0) this.last = out[out.length - 1] ?? null;
    return out;
  }

  reset(): void {
    this.photoId = null;
    this.arrived = false;
    this.last = null;
  }

  get lastEvent(): Readonly<GuidePresentingDetail> | null {
    return this.last;
  }
}
