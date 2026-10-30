import type { LayoutKind } from '@/lib/layout';
import type { ScreenRect } from '@/state/screenRects';

/**
 * Caption card placement (design spec 3.5, FR-64, US-12). A pure function: given the projected
 * screen rectangles the scene publishes, it picks the first dock where the card covers neither
 * the active picture, the Visitor, the Guide nor any HUD control. All rectangles are CSS pixels.
 */

export type Rect = ScreenRect;
export type DockKind = 'top' | 'bottom' | 'left' | 'right' | 'bottom-centre';
export type CardSize = 'full' | 'fitted' | 'strip';

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
  /** Caption scale (1, 1.25 or 1.5); sets the strip height. Defaults to 1.5 when `bigText`, else 1. */
  captionScale?: number;
  /**
   * True for the finale card, which has two action buttons that must stay visible: it gets a
   * taller full size and a taller strip than a caption card, and is never "fitted".
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
  /** Position in the candidate order of design spec 3.5 (0 is best). Used by the upgrade rule. */
  rank: number;
}

/** Breathing room kept around the card when testing for overlap (the "stay" test). */
export const DOCK_CLEARANCE = 8;
/** Margin for the upgrade test: wider than the stay test so a candidate that only just clears is not taken. */
export const UPGRADE_CLEARANCE = 16;
/** The upgrade margin against fixed HUD keep-outs: none, the dock is already offset from them. */
export const UPGRADE_KEEP_OUT_CLEARANCE = 0;
/** Fitted-size search keeps the stay-test margin against keep-outs, whichever test it serves. */
const DOCK_KEEP_OUT_CLEARANCE = DOCK_CLEARANCE;
/** `--panel-peek-height` (6.5 rem): 44 px header row + two caption lines at scale 1 (design spec 3.5). */
export const STRIP_HEIGHT = 104;
/** Strip heights at caption scale 1.25 and 1.5: two lines at 1 rem x scale x 1.4, rounded up to 4 px. */
export const STRIP_HEIGHT_LARGE = 112;
export const STRIP_HEIGHT_XLARGE = 124;
/**
 * The finale card's strip. Not the caption strip retired by v1.4 (`TALL_STRIP_HEIGHT`): the
 * finale has a heading and two buttons, no caption, so it needs 136 px. Caption cards never use it.
 */
export const FINALE_STRIP_HEIGHT = 136;
/** `--panel-fit-min-height` (8 rem): the smallest fitted card before a strip is used. */
export const FIT_MIN_HEIGHT = 128;
const FIT_STEP = 8;
const PORTRAIT_TALL_MAX_HEIGHT = 340;
/** `--panel-max-width` (26 rem). */
const PANEL_MAX_WIDTH = 416;
/**
 * The narrowest a card may ever be (`--card-min-width`, 16 rem). The scene's framing right bound
 * mirrors this (design spec 3.5, 6.12.2). Docks are widened to this, never shrunk below it.
 */
export const MIN_CARD_WIDTH = 256;
/** `--card-width-landscape` = clamp(16rem, 30vw, 22rem). */
export const LANDSCAPE_MAX_WIDTH = 352;
const LANDSCAPE_COLUMN = 0.3;
/** `--card-width-wide` = clamp(18rem, 28vw, 26rem). */
const WIDE_MIN_WIDTH = 288;
const WIDE_COLUMN = 0.28;
const PORTRAIT_MAX_HEIGHT = 224;
const DESKTOP_EDGE = 12;
const BOTTOM_STRIP_LIFT = 56;

/** Strip height for a caption scale (design spec 3.5). */
export function stripHeightFor(scale: number): number {
  if (scale >= 1.5) return STRIP_HEIGHT_XLARGE;
  if (scale >= 1.25) return STRIP_HEIGHT_LARGE;
  return STRIP_HEIGHT;
}

function scaleOf(input: DockInputs): number {
  return input.captionScale ?? (input.bigText ? 1.5 : 1);
}

/** Landscape card width for a window width, per `--card-width-landscape`. */
export function landscapeCardWidth(windowWidth: number): number {
  return Math.max(MIN_CARD_WIDTH, Math.min(windowWidth * LANDSCAPE_COLUMN, LANDSCAPE_MAX_WIDTH));
}

/** Tablet and desktop card width for a window width, per `--card-width-wide`. */
export function wideCardWidth(windowWidth: number): number {
  return Math.max(WIDE_MIN_WIDTH, Math.min(windowWidth * WIDE_COLUMN, PANEL_MAX_WIDTH));
}

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

export interface Candidate {
  dock: DockKind;
  size: CardSize;
  rect: Rect;
  expandedRect: Rect;
  /** Slot in the order of design spec 3.5. A fitted slot that is not valid is simply absent. */
  rank: number;
}

export function candidateKey(candidate: { dock: DockKind; size: CardSize }): string {
  return `${candidate.dock}:${candidate.size}`;
}

function sceneObstacles(input: DockInputs): Rect[] {
  const list: Rect[] = [...input.actors];
  if (input.picture) list.push(input.picture);
  return list;
}

/**
 * Clear of the scene rects (picture, characters, labels) by `clearance`, and of the fixed HUD
 * keep-outs by `keepOutClearance`. The dock is already positioned against the HUD keep-outs
 * (12 px below the bars), so the upgrade hysteresis margin applies to scene rects only (BUG-7).
 */
function isClear(
  rect: Rect,
  input: DockInputs,
  clearance = DOCK_CLEARANCE,
  keepOutClearance = clearance,
): boolean {
  const grown = growRect(rect, clearance);
  if (sceneObstacles(input).some((obstacle) => rectsIntersect(grown, obstacle))) return false;
  const grownKeepOut = keepOutClearance === clearance ? grown : growRect(rect, keepOutClearance);
  return !input.keepOut.some((obstacle) => rectsIntersect(grownKeepOut, obstacle));
}

/**
 * The candidates in the order of design spec 3.5. `clearance` is the margin used to size the
 * fitted card (8 px for the stay test, 16 px for the upgrade test).
 */
export function candidatesFor(input: DockInputs, clearance = DOCK_CLEARANCE): Candidate[] {
  const { viewport: vp, insets, layout } = input;
  const scale = input.bigText ? 1.3 : 1;
  const stripHeight = input.tall ? FINALE_STRIP_HEIGHT : stripHeightFor(scaleOf(input));
  const top = vp.y + insets.top;
  const bottomEdge = vp.y + vp.height - insets.bottom;
  const windowWidth = vp.width + vp.x * 2;
  const out: Candidate[] = [];
  let slot = 0;

  const make = (dock: DockKind, size: CardSize, rect: Rect, expandedRect: Rect = rect) => {
    out.push({
      dock,
      size,
      rect: { ...rect, width: Math.max(0, rect.width), height: Math.max(0, rect.height) },
      expandedRect,
      rank: slot++,
    });
  };

  /** The full card cut to the clear height, in 8 px steps; absent below 128 px (or for the finale). */
  const fitted = (dock: DockKind, full: Rect) => {
    let found: Rect | null = null;
    if (!input.tall) {
      for (let height = full.height - FIT_STEP; height >= FIT_MIN_HEIGHT; height -= FIT_STEP) {
        const test = { ...full, height };
        if (isClear(test, input, clearance, DOCK_KEEP_OUT_CLEARANCE)) {
          found = test;
          break;
        }
      }
    }
    if (found) make(dock, 'fitted', found, found);
    else slot++;
  };

  if (layout === 'phone-portrait') {
    const fullHeight = input.tall
      ? Math.min(PORTRAIT_TALL_MAX_HEIGHT, vp.height * 0.5)
      : Math.min(PORTRAIT_MAX_HEIGHT * scale, vp.height * 0.32 * scale);
    const full: Rect = { x: vp.x, y: top, width: vp.width, height: fullHeight };
    make('top', 'full', full);
    fitted('top', full);
    make('top', 'strip', { ...full, height: stripHeight }, full);
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
    const width = Math.min(vp.width, landscapeCardWidth(windowWidth));
    const rightX = vp.x + vp.width - width;
    const fullRight: Rect = { x: rightX, y: top, width, height: vp.y + vp.height - top };
    const fullLeft: Rect = { x: vp.x, y: top, width, height: bottomEdge - top };
    make('right', 'full', fullRight);
    make('left', 'full', fullLeft);
    fitted('right', fullRight);
    make('right', 'strip', { ...fullRight, height: stripHeight }, fullRight);
    make('left', 'strip', { ...fullLeft, height: stripHeight }, fullLeft);
  } else {
    const width = Math.min(vp.width, wideCardWidth(windowWidth));
    const height = Math.min(vp.height * 0.5 * scale, vp.y + vp.height - top);
    const rightX = vp.x + vp.width - width - DESKTOP_EDGE;
    const leftX = vp.x + DESKTOP_EDGE;
    const fullRight: Rect = { x: rightX, y: top, width, height };
    const fullLeft: Rect = { x: leftX, y: top, width, height };
    make('right', 'full', fullRight);
    make('left', 'full', fullLeft);
    fitted('right', fullRight);
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

/** True when a placement made earlier is still clear of everything (used for the 400 ms stability rule). */
export function isPlacementClear(placement: Placement, input: DockInputs): boolean {
  return isClear(placement.rect, input);
}

/** The middle third of the picture in both directions: a strip must never cover it (design spec 3.5). */
export function pictureCentre(picture: Rect): Rect {
  return {
    x: picture.x + picture.width / 3,
    y: picture.y + picture.height / 3,
    width: picture.width / 3,
    height: picture.height / 3,
  };
}

/**
 * Picks the first candidate, in the order of design spec 3.5 (full, then fitted at 128 px or
 * more, then strip), whose rectangle (grown by 8 px) does not intersect the picture, either
 * character or any HUD keep-out. If none qualifies it picks a strip: among those that keep off
 * the picture's centre third (if any do), the one overlapping the picture least, then the
 * characters.
 */
export function chooseCaptionDock(input: DockInputs): Placement {
  const candidates = candidatesFor(input);
  for (const candidate of candidates) {
    if (isClear(candidate.rect, input)) {
      return { ...candidate, layout: input.layout, clear: true };
    }
  }

  const strips = candidates.filter((candidate) => candidate.size === 'strip');
  let pool = strips.length > 0 ? strips : candidates;
  if (input.picture) {
    const centre = pictureCentre(input.picture);
    const offCentre = pool.filter((candidate) => !rectsIntersect(candidate.rect, centre));
    if (offCentre.length > 0) pool = offCentre;
  }
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

/** Candidates better than `placement` that are clear at the upgrade margin (16 px), best first. */
export function clearUpgradeCandidates(placement: Placement, input: DockInputs): Candidate[] {
  return candidatesFor(input, UPGRADE_CLEARANCE).filter(
    (candidate) => candidate.rank < placement.rank && isClear(candidate.rect, input, UPGRADE_CLEARANCE, UPGRADE_KEEP_OUT_CLEARANCE),
  );
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
