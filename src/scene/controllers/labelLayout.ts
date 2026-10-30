import { Vector3, type Camera } from 'three';
import { labelAnchorHeight } from '@/domain/camera/presentationFraming';
import type { ScreenRect } from '@/state/screenRects';

/**
 * Name label layout while a presentation is active (design spec 5.5), run about every 100 ms:
 *  1. Framed view: a label that touches the picture (grown by 8 px) slides sideways, away from the
 *     picture's centre, by up to half its own width. Never hidden, never scaled, never moved up.
 *  2. Collision: if the two labels still overlap, the label of the character farther from the
 *     camera is raised by its own height plus 4 px.
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

/** Returns the final label rectangles (with their offsets), or null for a hidden label. */
export function layoutLabels(
  actors: readonly LabelActor[],
  camera: Camera,
  area: { left: number; top: number; width: number; height: number },
  picture: ScreenRect | null,
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
  }> = [];

  for (const actor of actors) {
    const el = actor.element;
    if (!el) continue;
    if (Number(el.style.opacity || 0) < 0.05) {
      write(el, 0, 0);
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

  for (const it of items) {
    write(it.el, it.dx, it.dy);
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
  for (const el of elements) if (el) write(el, 0, 0);
}
