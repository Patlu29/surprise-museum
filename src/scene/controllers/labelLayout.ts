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
 * Rectangles come from the projected head anchors and the labels' layout sizes, not from
 * `getBoundingClientRect`, so a transition in progress cannot feed back into the measurement.
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
const v = new Vector3();

function intersects(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function shiftBox(b: Box, dx: number, dy: number): Box {
  return { left: b.left + dx, right: b.right + dx, top: b.top + dy, bottom: b.bottom + dy };
}

function write(el: HTMLElement, dx: number, dy: number): void {
  const value = dx !== 0 || dy !== 0 ? `${Math.round(dx)}px ${Math.round(dy)}px` : '';
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
  const items: Array<{
    actor: LabelActor;
    el: HTMLElement;
    box: Box;
    w: number;
    h: number;
    dx: number;
    dy: number;
    depth: number;
    cx: number;
  }> = [];

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
    const cx = area.left + (v.x * 0.5 + 0.5) * area.width;
    const cy = area.top + (-v.y * 0.5 + 0.5) * area.height;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const dx = camera.position.x - actor.x;
    const dz = camera.position.z - actor.z;
    items.push({
      actor,
      el,
      w,
      h,
      dx: 0,
      dy: 0,
      depth: Math.hypot(dx, dz),
      cx,
      box: { left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2 },
    });
  }

  if (picture) {
    const grown: Box = {
      left: picture.x - GROW,
      top: picture.y - GROW,
      right: picture.x + picture.width + GROW,
      bottom: picture.y + picture.height + GROW,
    };
    const centre = picture.x + picture.width / 2;
    for (const it of items) {
      if (!intersects(it.box, grown)) continue;
      const away = (it.box.left + it.box.right) / 2 >= centre ? 1 : -1;
      const needed = away > 0 ? grown.right - it.box.left : it.box.right - grown.left;
      it.dx = away * Math.min(Math.max(needed, 0), it.w / 2);
    }
  }

  const [a, b] = items;
  if (a && b) {
    const ra = shiftBox(a.box, a.dx, 0);
    const rb = shiftBox(b.box, b.dx, 0);
    if (intersects(ra, rb)) {
      const far = a.depth > b.depth ? a : b;
      far.dy = -(far.h + 4);
    }
  }

  if (minTop !== null) for (const it of items) it.dy = Math.max(it.dy, clampDown(it.box, minTop));

  // 12.6.8, last: hide a label whose head anchor is off screen sideways, clamp into the viewport,
  // push overlapping labels apart, and let the picture win over the viewport edge.
  const minLeft = area.left + LABEL_EDGE_MARGIN;
  const maxRight = area.left + area.width - LABEL_EDGE_MARGIN;
  const visible = items.filter((it) => {
    const off = it.cx < area.left || it.cx > area.left + area.width;
    it.el.style.visibility = off ? 'hidden' : '';
    return !off;
  });
  for (const it of visible) it.dx += clampShiftX(shiftBox(it.box, it.dx, 0), minLeft, maxRight);
  const [first, second] = visible;
  if (first && second) {
    const [da, db] = separateShiftX(
      shiftBox(first.box, first.dx, first.dy),
      shiftBox(second.box, second.dx, second.dy),
      minLeft,
      maxRight,
    );
    first.dx += da;
    second.dx += db;
  }
  if (picture) {
    const grown: Box = {
      left: picture.x - GROW,
      top: picture.y - GROW,
      right: picture.x + picture.width + GROW,
      bottom: picture.y + picture.height + GROW,
    };
    const centre = picture.x + picture.width / 2;
    for (const it of visible) {
      const r = shiftBox(it.box, it.dx, it.dy);
      if (!intersects(r, grown)) continue;
      const away = (r.left + r.right) / 2 >= centre ? 1 : -1;
      const move = away > 0 ? grown.right - r.left : -(r.right - grown.left);
      // Never further out than 40% of the label past the viewport edge.
      const limit =
        away > 0
          ? area.left + area.width - LABEL_EDGE_MARGIN + it.w * LABEL_EDGE_OVERHANG - r.right
          : area.left + LABEL_EDGE_MARGIN - it.w * LABEL_EDGE_OVERHANG - r.left;
      it.dx += away > 0 ? Math.min(move, Math.max(0, limit)) : Math.max(move, Math.min(0, limit));
    }
  }

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
    el.style.visibility = '';
  }
}
