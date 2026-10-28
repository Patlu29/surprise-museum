/**
 * Projected screen rectangles published by the scene while a presentation is active, read by
 * the caption card's placement rule (`chooseCaptionDock`, design spec 3.5). A plain mutable
 * object, not a store: the scene refreshes it about every 100 ms and the UI polls it at the
 * same rate, so nothing re-renders per frame.
 *
 * All rectangles are in CSS pixels in viewport (client) coordinates, which equal canvas
 * coordinates because the canvas fills the viewport. Include name labels in the actors' rects.
 */
export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenRects {
  /** The active picture's frame projected to the screen, or null if off-screen or behind the camera. */
  picture: ScreenRect | null;
  /** The Visitor and the Guide, each including its name label, or null when off-screen. */
  visitor: ScreenRect | null;
  guide: ScreenRect | null;
  /** `performance.now()` of the last publish. The UI ignores rectangles older than a second. */
  updatedAt: number;
}

export const screenRects: ScreenRects = {
  picture: null,
  visitor: null,
  guide: null,
  updatedAt: 0,
};

/** The scene calls this about every 100 ms while a presentation is active. */
export function publishScreenRects(next: Partial<Omit<ScreenRects, 'updatedAt'>>): void {
  if ('picture' in next) screenRects.picture = next.picture ?? null;
  if ('visitor' in next) screenRects.visitor = next.visitor ?? null;
  if ('guide' in next) screenRects.guide = next.guide ?? null;
  screenRects.updatedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function clearScreenRects(): void {
  screenRects.picture = null;
  screenRects.visitor = null;
  screenRects.guide = null;
  screenRects.updatedAt = 0;
}
