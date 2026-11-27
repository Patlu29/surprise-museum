import { Vector3, type Camera } from 'three';
import { labelAnchorHeight } from '@/domain/camera/presentationFraming';
import type { ScreenRect } from '@/state/screenRects';

/**
 * Name label layout while a presentation is active (design spec 5.5), run about every 100 ms:
 *  1. Framed view: a label that touches the picture (grown by 8 px) slides sideways, away from the
 *     picture's centre, by up to half its own width. Never hidden, never scaled, never moved up.
 *  2. Collision: if the two labels still overlap, the label of the character farther from the
 *     camera is raised by its own height plus 4 px.
 *  3. Narrow screens (spec 12.6.8, N-10), applied last, after the BUG-10 strip rule: a label stays
 *     at least 8 px inside the viewport, two labels that still overlap are pushed apart sideways
 *     by half the overlap each (plus an 8 px gap, then re-clamped), and a label whose head anchor
 *     is off screen horizontally is hidden. The picture comes first: if keeping it clear and
 *     staying inside cannot both hold, up to 40% of the label may go past the edge.
 *  4. Stacking (13.8, FR-111), when the labels still overlap: the lower label (lower head anchor)
 *     stays at its anchor and the upper one rises to 4 px above it, unless the picture, the strip
 *     or the top margin stop it; then both widen to `min(2 x --label-max-width, 100vw - 16px)` and
 *     the layout runs again; the 4 px drop of the lower label is the last resort.
 *  5. The 8 px margin (FR-109) is the last horizontal step: widths are read fractionally and the
 *     offset is rounded inwards, so the edge is never inside the margin.
 * Positions come from the projected head anchors; widths and heights from the label's box. A
 * `translate` transition does not change a size, so a transition in progress cannot feed back.
 */
export interface LabelActor {
  role: 'visitor' | 'guide';
  element: HTMLElement | null;
  x: number;
  z: number;
  height: number;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const GROW = 8;
const STACK_GAP = 4;
const v = new Vector3();

/** The label's normal width cap (design spec 5.5): the 36vw cap keeps room beside the picture. */
export const LABEL_MAX_WIDTH = 'min(var(--label-max-width, 11rem), 36vw)';
/** The cap while two labels are stacked (13.8): twice the token, never wider than the viewport less 16 px. */
export const LABEL_MAX_WIDTH_WIDE =
  'min(calc(2 * var(--label-max-width, 11rem)), calc(100vw - 16px))';

function intersects(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function shiftBox(b: Box, dx: number, dy: number): Box {
  return { left: b.left + dx, right: b.right + dx, top: b.top + dy, bottom: b.bottom + dy };
}

function write(el: HTMLElement, dx: number, dy: number): void {
  const value = dx !== 0 || dy !== 0 ? `${dx}px ${dy}px` : '';
  if (el.dataset.offset !== value) {
    el.dataset.offset = value;
    el.style.translate = value;
  }
}

/** How far a label box must move down to keep its top at or below `minTop` (0 when it already is). */
export function clampDown(box: { top: number }, minTop: number): number {
  return Math.max(0, minTop - box.top);
}

/** Labels stay at least this far inside the viewport (12.6.8). */
export const LABEL_EDGE_MARGIN = 8;
/** Gap kept between two labels pushed apart (12.6.8: two labels plus an 8 px gap). */
export const LABEL_GAP = 8;
/** When the picture and the viewport edge conflict, this share of a label may pass the edge. */
export const LABEL_EDGE_OVERHANG = 0.4;

/** Horizontal shift that brings a box inside [minLeft, maxRight] (left wins if it cannot fit). */
export function clampShiftX(
  box: { left: number; right: number },
  minLeft: number,
  maxRight: number,
): number {
  if (box.right - box.left >= maxRight - minLeft) return minLeft - box.left;
  if (box.left < minLeft) return minLeft - box.left;
  if (box.right > maxRight) return maxRight - box.right;
  return 0;
}

/**
 * Pushes two overlapping labels apart sideways (12.6.8): half the overlap plus the gap each, then
 * both are re-clamped inside [minLeft, maxRight], and whatever is still short moves the label that
 * has room. Returns the extra shifts for (a, b); both 0 when they do not overlap.
 */
export function separateShiftX(
  a: Box,
  b: Box,
  minLeft: number,
  maxRight: number,
  gap: number = LABEL_GAP,
): [number, number] {
  if (!intersects(a, b)) return [0, 0];
  const aFirst = (a.left + a.right) / 2 <= (b.left + b.right) / 2;
  const first = aFirst ? a : b;
  const second = aFirst ? b : a;
  const w1 = first.right - first.left;
  const w2 = second.right - second.left;
  const deficit0 = first.right + gap - second.left; // how far the second must clear the first
  let l1 = first.left - deficit0 / 2;
  let l2 = second.left + deficit0 / 2;
  l1 = Math.min(Math.max(l1, minLeft), Math.max(minLeft, maxRight - w1));
  l2 = Math.min(Math.max(l2, minLeft), Math.max(minLeft, maxRight - w2));
  let deficit = l1 + w1 + gap - l2;
  if (deficit > 0) {
    const m1 = Math.min(deficit, Math.max(0, l1 - minLeft));
    l1 -= m1;
    deficit -= m1;
    l2 = Math.min(l2 + deficit, Math.max(minLeft, maxRight - w2));
  }
  const d1 = l1 - first.left;
  const d2 = l2 - second.left;
  return aFirst ? [d1, d2] : [d2, d1];
}

/** How far `lower` must move down to sit `gap` px under `upper` (0 when it already does). */
export function stackShiftY(
  upper: { bottom: number },
  lower: { top: number },
  gap = STACK_GAP,
): number {
  return Math.max(0, upper.bottom + gap - lower.top);
}

/**
 * Whole-pixel offset along x that keeps [left, right] inside [minLeft, maxRight] (FR-109): the
 * fractional offset is rounded to the nearest pixel, then pulled inwards (up against the left
 * margin, down against the right one) if rounding left an edge inside the margin. Left wins when
 * the box is wider than the room.
 */
export function insideShiftX(
  box: { left: number; right: number },
  dx: number,
  minLeft: number,
  maxRight: number,
): number {
  let out = Math.round(dx);
  if (box.right + out > maxRight) out = Math.floor(maxRight - box.right);
  if (box.left + out < minLeft) out = Math.ceil(minLeft - box.left);
  return out;
}

/** How far the upper label must rise so its bottom sits `gap` px above the lower label's top. */
export function riseShiftY(
  upper: { bottom: number },
  lower: { top: number },
  gap = STACK_GAP,
): number {
  return Math.max(0, upper.bottom - (lower.top - gap));
}

interface Item {
  actor: LabelActor;
  el: HTMLElement;
  /** The label at its anchor, before any offset; the width and height are the measured box. */
  box: Box;
  cx: number;
  cy: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  depth: number;
  /** The picture pushed this label past the 8 px margin (the accepted N-10 case). */
  overhang: boolean;
}

interface Context {
  area: { left: number; top: number; width: number; height: number };
  /** The picture grown by 8 px, or null when none is framed. */
  grown: Box | null;
  minTop: number | null;
  minLeft: number;
  maxRight: number;
  /** Widened labels stack vertically, so they are not pushed apart sideways (13.8 step 3). */
  stacked?: boolean;
}

/**
 * Switch a label between its normal width cap and the stacked (wide) cap. `room` is the free
 * width beside the picture in px: a label never widens into the picture (13.8 step 3), so the
 * wide cap is also limited to it (never below the normal width).
 */
function setWide(el: HTMLElement, wide: boolean, room: number | null = null): void {
  const flag = wide ? (room === null ? '1' : `1:${Math.floor(room)}`) : '';
  if ((el.dataset.wide ?? '') === flag) return;
  el.dataset.wide = flag;
  el.style.maxWidth = !wide
    ? LABEL_MAX_WIDTH
    : room === null
      ? LABEL_MAX_WIDTH_WIDE
      : `max(${LABEL_MAX_WIDTH}, min(${LABEL_MAX_WIDTH_WIDE}, ${Math.floor(room)}px))`;
}

/** Real, fractional size of the label's box (13.8: not `offsetWidth`, which rounds). */
function measure(it: Item): void {
  const r = it.el.getBoundingClientRect();
  it.w = r.width;
  it.h = r.height;
  it.box = {
    left: it.cx - it.w / 2,
    right: it.cx + it.w / 2,
    top: it.cy - it.h / 2,
    bottom: it.cy + it.h / 2,
  };
}

function growPicture(picture: ScreenRect): Box {
  return {
    left: picture.x - GROW,
    top: picture.y - GROW,
    right: picture.x + picture.width + GROW,
    bottom: picture.y + picture.height + GROW,
  };
}

function collectItems(
  actors: readonly LabelActor[],
  camera: Camera,
  area: Context['area'],
): Item[] {
  const items: Item[] = [];
  for (const actor of actors) {
    const el = actor.element;
    if (!el) continue;
    if (Number(el.style.opacity || 0) < 0.05) {
      write(el, 0, 0);
      el.style.visibility = '';
      continue;
    }
    v.set(actor.x, labelAnchorHeight(actor.height), actor.z).project(camera);
    if (v.z > 1 || v.z < -1) continue;
    setWide(el, false);
    const dx = camera.position.x - actor.x;
    const dz = camera.position.z - actor.z;
    const it: Item = {
      actor,
      el,
      box: { left: 0, right: 0, top: 0, bottom: 0 },
      cx: area.left + (v.x * 0.5 + 0.5) * area.width,
      cy: area.top + (-v.y * 0.5 + 0.5) * area.height,
      w: 0,
      h: 0,
      dx: 0,
      dy: 0,
      depth: Math.hypot(dx, dz),
      overhang: false,
    };
    measure(it);
    items.push(it);
  }
  return items;
}

/**
 * Rules 1 to 3 (picture, collision raise, strip floor, then the viewport margin, sideways push and
 * the picture again). Starts from no offsets. Returns the labels that are drawn.
 */
function arrange(items: Item[], ctx: Context): Item[] {
  const { grown, minLeft, maxRight, area } = ctx;
  for (const it of items) {
    it.dx = 0;
    it.dy = 0;
    it.overhang = false;
  }
  if (grown) {
    const centre = (grown.left + grown.right) / 2;
    for (const it of items) {
      if (!intersects(it.box, grown)) continue;
      const away = (it.box.left + it.box.right) / 2 >= centre ? 1 : -1;
      const needed = away > 0 ? grown.right - it.box.left : it.box.right - grown.left;
      it.dx = away * Math.min(Math.max(needed, 0), it.w / 2);
    }
  }

  const [a, b] = items;
  if (a && b && intersects(shiftBox(a.box, a.dx, 0), shiftBox(b.box, b.dx, 0))) {
    const far = a.depth > b.depth ? a : b;
    far.dy = -(far.h + 4);
  }

  if (ctx.minTop !== null)
    for (const it of items) it.dy = Math.max(it.dy, clampDown(it.box, ctx.minTop));

  // 12.6.8: hide a label whose head anchor is off screen sideways, clamp into the viewport, push
  // overlapping labels apart, and let the picture win over the viewport edge.
  const visible = items.filter((it) => {
    const off = it.cx < area.left || it.cx > area.left + area.width;
    it.el.style.visibility = off ? 'hidden' : '';
    return !off;
  });
  for (const it of visible) it.dx += clampShiftX(shiftBox(it.box, it.dx, 0), minLeft, maxRight);
  const [first, second] = visible;
  if (first && second && !ctx.stacked) {
    const [da, db] = separateShiftX(
      shiftBox(first.box, first.dx, first.dy),
      shiftBox(second.box, second.dx, second.dy),
      minLeft,
      maxRight,
    );
    first.dx += da;
    second.dx += db;
  }
  if (grown) {
    const centre = (grown.left + grown.right) / 2;
    for (const it of visible) {
      const r = shiftBox(it.box, it.dx, it.dy);
      if (!intersects(r, grown)) continue;
      const away = (r.left + r.right) / 2 >= centre ? 1 : -1;
      const move = away > 0 ? grown.right - r.left : -(r.right - grown.left);
      // Never further out than 40% of the label past the viewport edge.
      const limit =
        away > 0
          ? maxRight + it.w * LABEL_EDGE_OVERHANG - r.right
          : minLeft - it.w * LABEL_EDGE_OVERHANG - r.left;
      it.dx += away > 0 ? Math.min(move, Math.max(0, limit)) : Math.max(move, Math.min(0, limit));
    }
  }
  for (const it of visible) {
    const r = shiftBox(it.box, it.dx, 0);
    it.overhang =
      it.w <= maxRight - minLeft && (r.left < minLeft - 1e-6 || r.right > maxRight + 1e-6);
  }
  return visible;
}

/** The two labels, lower first, when they overlap; null when they do not (13.8 step 1). */
function stackedPair(visible: Item[]): { lower: Item; upper: Item } | null {
  const [a, b] = visible;
  if (!a || !b) return null;
  if (!intersects(shiftBox(a.box, a.dx, a.dy), shiftBox(b.box, b.dx, b.dy))) return null;
  // The lower label has the lower head anchor (larger y); on a tie it is the Visitor's.
  const aLower = a.cy > b.cy || (a.cy === b.cy && a.actor.role === 'visitor');
  return aLower ? { lower: a, upper: b } : { lower: b, upper: a };
}

/** 13.8 step 2: the upper label rises to 4 px above the lower one, as far as its limits allow. */
function riseUpper(pair: { lower: Item; upper: Item }, ctx: Context): void {
  const { lower, upper } = pair;
  const ru = shiftBox(upper.box, upper.dx, upper.dy);
  const rl = shiftBox(lower.box, lower.dx, lower.dy);
  let floor = ctx.area.top + LABEL_EDGE_MARGIN;
  if (ctx.minTop !== null) floor = Math.max(floor, ctx.minTop);
  const g = ctx.grown;
  // Below the picture and across from it: rising would run into the picture grown by 8 px.
  if (g && ru.left < g.right && ru.right > g.left && ru.top >= g.bottom - 0.5) {
    floor = Math.max(floor, g.bottom);
  }
  const room = Math.max(0, Math.floor(ru.top - floor));
  upper.dy -= Math.min(Math.ceil(riseShiftY(ru, rl)), room);
}

/** 13.8 step 3 is accepted only if it keeps the margin and the picture clear. */
function wideFits(visible: Item[], ctx: Context): boolean {
  return visible.every(
    (it) => !it.overhang && !(ctx.grown && intersects(shiftBox(it.box, it.dx, it.dy), ctx.grown)),
  );
}

/** 13.8 step 3: widen both labels and run the layout again; keeps the narrow layout if it fails. */
function tryWide(items: Item[], visible: Item[], ctx: Context): Item[] {
  const saved = items.map((it) => ({ ...it, box: { ...it.box } }));
  for (const it of items) {
    const g = ctx.grown;
    const room = g
      ? (it.box.left + it.box.right) / 2 < (g.left + g.right) / 2
        ? g.left - ctx.minLeft
        : ctx.maxRight - g.right
      : null;
    setWide(it.el, true, room);
  }
  for (const it of items) measure(it);
  const wide = arrange(items, { ...ctx, stacked: true });
  const pair = stackedPair(wide);
  if (pair) riseUpper(pair, ctx);
  if (wideFits(wide, ctx)) return wide;
  items.forEach((it, i) => {
    const s = saved[i];
    if (!s) return;
    Object.assign(it, s);
    setWide(it.el, false);
  });
  return visible;
}

/**
 * Last horizontal step (13.8, FR-109): whole-pixel offsets, rounded so a label against a margin
 * is never inside it. A label the picture pushed out (N-10) keeps its plain rounded offset.
 */
function settle(items: Item[], visible: Item[], ctx: Context): void {
  for (const it of items) {
    it.dy = Math.round(it.dy);
    it.dx =
      visible.includes(it) && !it.overhang
        ? insideShiftX(it.box, it.dx, ctx.minLeft, ctx.maxRight)
        : Math.round(it.dx);
  }
}

/** Returns the final label rectangles (with their offsets), or null for a hidden label. */
export function layoutLabels(
  actors: readonly LabelActor[],
  camera: Camera,
  area: { left: number; top: number; width: number; height: number },
  picture: ScreenRect | null,
  /** Portrait strip (BUG-10): a label may not sit above this y (CSS px, viewport); it slides down. */
  minTop: number | null = null,
): Record<'visitor' | 'guide', ScreenRect | null> {
  const out: Record<'visitor' | 'guide', ScreenRect | null> = { visitor: null, guide: null };
  const items = collectItems(actors, camera, area);
  const ctx: Context = {
    area,
    grown: picture ? growPicture(picture) : null,
    minTop,
    minLeft: area.left + LABEL_EDGE_MARGIN,
    maxRight: area.left + area.width - LABEL_EDGE_MARGIN,
  };

  let visible = arrange(items, ctx);
  let pair = stackedPair(visible);
  if (pair) {
    riseUpper(pair, ctx);
    pair = stackedPair(visible);
  }
  if (pair) visible = tryWide(items, visible, ctx);
  pair = stackedPair(visible);
  if (pair) {
    // Last resort (13.8 step 4): the lower label drops 4 px below the upper one.
    const ru = shiftBox(pair.upper.box, pair.upper.dx, pair.upper.dy);
    const rl = shiftBox(pair.lower.box, pair.lower.dx, pair.lower.dy);
    pair.lower.dy += Math.ceil(stackShiftY(ru, rl));
  }
  settle(items, visible, ctx);

  for (const it of items) {
    write(it.el, it.dx, it.dy);
    if (it.el.style.visibility === 'hidden') continue;
    const r = shiftBox(it.box, it.dx, it.dy);
    out[it.actor.role] = {
      x: r.left,
      y: r.top,
      width: r.right - r.left,
      height: r.bottom - r.top,
    };
  }
  return out;
}

/** Put both labels back where the Html anchor puts them (the presentation ended). */
export function resetLabels(elements: ReadonlyArray<HTMLElement | undefined>): void {
  for (const el of elements) {
    if (!el) continue;
    write(el, 0, 0);
    setWide(el, false);
    el.style.visibility = '';
  }
}
