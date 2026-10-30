import type { LayoutKind } from '@/lib/layout';
import type { ScreenRect } from '@/state/screenRects';

/**
 * Caption card placement (design spec 3.5, FR-64, US-12). A pure function: given the projected
 * screen rectangles the scene publishes, it picks the first dock where the card covers neither
 * the active picture, the Visitor, the Guide nor any HUD control. All rectangles are CSS pixels.
 */

export type Rect = ScreenRect;
export type DockKind = 'top' | 'bottom' | 'left' | 'right' | 'bottom-centre';
export type CardSize = 'full' | 'strip';

export interface DockInputs {
  layout: LayoutKind;
  /** Usable area: the window minus safe areas and the HUD margin. */
  viewport: Rect;
  /** Pixels the HUD reserves at the top (top bar, preview bar) and at the bottom (joystick zone on touch). */
  insets: { top: number; bottom: number };
  /** HUD rectangles the card must not cover: top bar, joystick base, preview bar, chips. */
  keepOut: readonly Rect[];
  /** The active picture's frame on screen, or null if off-screen or behind the camera. */
  picture: Rect | null;
  /** The Visitor and the Guide, including their name labels. */
  actors: readonly Rect[];
  /** True when the caption scale is above 1: the card is allowed to be taller. */
  bigText: boolean;
  /**
   * True for the finale card, which has two action buttons that must stay visible: it gets a
   * taller full size and a taller strip than a caption card.
   */
  tall?: boolean;
}

export interface Placement {
  dock: DockKind;
  size: CardSize;
  layout: LayoutKind;
  rect: Rect;
  /** The same dock at full size, for "Read more" on a strip. Expanding is the Visitor's choice, so it may overlap. */
  expandedRect: Rect;
  /** False when no candidate was clear and this is the least-overlapping strip. */
  clear: boolean;
}

/** Breathing room kept around the card when testing for overlap. */
export const DOCK_CLEARANCE = 8;
/** `--panel-peek-height` (4 rem). */
export const STRIP_HEIGHT = 64;
/** A strip tall enough for the finale's heading and its two buttons. */
export const TALL_STRIP_HEIGHT = 136;
const PORTRAIT_TALL_MAX_HEIGHT = 340;
/** `--panel-max-width` (26 rem). */
const PANEL_MAX_WIDTH = 416;
const LANDSCAPE_MAX_WIDTH = 352;
/**
 * The narrowest a card may ever be (18 rem): badge, a readable name, the icon-only Look closer and
 * Close fit in one row. Docks are widened to this, never shrunk below it (design spec 3.5).
 */
export const MIN_CARD_WIDTH = 288;
/** Landscape card column as a share of the width: the 30% the presentation framing reserves (6.12.2). */
const LANDSCAPE_COLUMN = 0.3;
const PORTRAIT_MAX_HEIGHT = 224;
const DESKTOP_EDGE = 12;
const BOTTOM_STRIP_LIFT = 56;

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function intersectionArea(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

export function growRect(rect: Rect, by: number): Rect {
  return {
    x: rect.x - by,
    y: rect.y - by,
    width: rect.width + by * 2,
    height: rect.height + by * 2,
  };
}

interface Candidate {
  dock: DockKind;
  size: CardSize;
  rect: Rect;
  expandedRect: Rect;
}

function heightScale(bigText: boolean): number {
  return bigText ? 1.3 : 1;
}

function candidatesFor(input: DockInputs): Candidate[] {
  const { viewport: vp, insets, layout } = input;
  const scale = heightScale(input.bigText);
  const stripHeight = input.tall ? TALL_STRIP_HEIGHT : STRIP_HEIGHT;
  const top = vp.y + insets.top;
  const bottomEdge = vp.y + vp.height - insets.bottom;
  const out: Candidate[] = [];

  const make = (dock: DockKind, size: CardSize, rect: Rect, expandedRect: Rect = rect) => {
    out.push({
      dock,
      size,
      rect: { ...rect, width: Math.max(0, rect.width), height: Math.max(0, rect.height) },
      expandedRect,
    });
  };

  if (layout === 'phone-portrait') {
    const fullHeight = input.tall
      ? Math.min(PORTRAIT_TALL_MAX_HEIGHT, vp.height * 0.5)
      : Math.min(PORTRAIT_MAX_HEIGHT * scale, vp.height * 0.32 * scale);
    const full: Rect = { x: vp.x, y: top, width: vp.width, height: fullHeight };
    const strip: Rect = { ...full, height: stripHeight };
    make('top', 'full', full);
    make('top', 'strip', strip, full);
    const bottomStrip: Rect = {
      x: vp.x,
      y: bottomEdge - stripHeight,
      width: vp.width,
      height: stripHeight,
    };
    make('bottom', 'strip', bottomStrip, {
      ...bottomStrip,
      y: bottomEdge - fullHeight,
      height: fullHeight,
    });
  } else if (layout === 'phone-landscape') {
    const width = Math.min(
      vp.width,
      Math.max(MIN_CARD_WIDTH, Math.min(vp.width * LANDSCAPE_COLUMN, LANDSCAPE_MAX_WIDTH)),
    );
    const rightX = vp.x + vp.width - width;
    const fullRight: Rect = { x: rightX, y: top, width, height: vp.y + vp.height - top };
    const fullLeft: Rect = { x: vp.x, y: top, width, height: bottomEdge - top };
    make('right', 'full', fullRight);
    make('left', 'full', fullLeft);
    make('right', 'strip', { ...fullRight, height: stripHeight }, fullRight);
  } else {
    const width = Math.min(vp.width, Math.max(MIN_CARD_WIDTH, Math.min(PANEL_MAX_WIDTH, vp.width * 0.9)));
    const height = Math.min(vp.height * 0.5 * scale, vp.y + vp.height - top);
    const rightX = vp.x + vp.width - width - DESKTOP_EDGE;
    const leftX = vp.x + DESKTOP_EDGE;
    const fullRight: Rect = { x: rightX, y: top, width, height };
    const fullLeft: Rect = { x: leftX, y: top, width, height };
    make('right', 'full', fullRight);
    make('left', 'full', fullLeft);
    make('right', 'strip', { ...fullRight, height: stripHeight }, fullRight);
    const stripWidth = Math.min(vp.width, Math.max(MIN_CARD_WIDTH, Math.min(vp.width * 0.6, 640)));
    const centre: Rect = {
      x: vp.x + (vp.width - stripWidth) / 2,
      y: bottomEdge - stripHeight - BOTTOM_STRIP_LIFT,
      width: stripWidth,
      height: stripHeight,
    };
    make('bottom-centre', 'strip', centre, {
      ...centre,
      y: centre.y + stripHeight - height,
      height,
    });
  }
  return out;
}

function obstacles(input: DockInputs): Rect[] {
  const list: Rect[] = [...input.keepOut, ...input.actors];
  if (input.picture) list.push(input.picture);
  return list;
}

function isClear(rect: Rect, input: DockInputs): boolean {
  const grown = growRect(rect, DOCK_CLEARANCE);
  return !obstacles(input).some((obstacle) => rectsIntersect(grown, obstacle));
}

/** True when a placement made earlier is still clear of everything (used for the 400 ms stability rule). */
export function isPlacementClear(placement: Placement, input: DockInputs): boolean {
  return isClear(placement.rect, input);
}

/**
 * Picks the first candidate, in the order of design spec 3.5, whose rectangle (grown by 8 px)
 * does not intersect the picture, either character or any HUD keep-out. If none qualifies it
 * picks the strip that overlaps the picture least, then the characters (always strip size).
 */
export function chooseCaptionDock(input: DockInputs): Placement {
  const candidates = candidatesFor(input);
  for (const candidate of candidates) {
    if (isClear(candidate.rect, input)) {
      return { ...candidate, layout: input.layout, clear: true };
    }
  }

  const strips = candidates.filter((candidate) => candidate.size === 'strip');
  const pool = strips.length > 0 ? strips : candidates;
  let best = pool[0];
  let bestScore: [number, number] = [Infinity, Infinity];
  for (const candidate of pool) {
    const grown = growRect(candidate.rect, DOCK_CLEARANCE);
    const pictureOverlap = input.picture ? intersectionArea(grown, input.picture) : 0;
    const otherOverlap = [...input.actors, ...input.keepOut].reduce(
      (sum, rect) => sum + intersectionArea(grown, rect),
      0,
    );
    const score: [number, number] = [pictureOverlap, otherOverlap];
    if (score[0] < bestScore[0] || (score[0] === bestScore[0] && score[1] < bestScore[1])) {
      best = candidate;
      bestScore = score;
    }
  }
  // `candidates` is never empty for any layout, so `best` exists.
  const chosen = best as Candidate;
  return { ...chosen, layout: input.layout, clear: false };
}

export function samePlacement(a: Placement | null, b: Placement | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.dock === b.dock &&
    a.size === b.size &&
    a.layout === b.layout &&
    a.rect.x === b.rect.x &&
    a.rect.y === b.rect.y &&
    a.rect.width === b.rect.width &&
    a.rect.height === b.rect.height
  );
}
