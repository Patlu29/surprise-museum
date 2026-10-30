import {
  firstHitDistance,
  inflateAabb,
  pointInAabb,
  segmentClear,
  type Aabb,
} from '../navigation/geometry';
import { angleDiff, clamp, distToSegment, type Vec2 } from '../math/vec2';
import { classifyViewport, computeComposition, type ViewportClass } from './composition';

/**
 * Presentation camera framing (design spec 6.12, v1.2, resolves QA N-2). A pure solver: given the
 * picture, the Visitor, the Guide's destination, the room and the viewport, it returns where the
 * camera should stand and aim so the whole picture is visible and clear with both characters
 * beside it, or `null` when every candidate breaks a wall rule (then the follow camera stays).
 *
 * Everything is projected through the real camera model, including the constant view offset
 * (design spec 3.4, ADR 0014): the FOV and the offset never change, only where the camera
 * stands. Plan axes follow the repo convention: heading h has forward (sin h, cos h).
 *
 * The solver runs once per presentation (and again for a new presentation or a viewport
 * change), never per frame, so the camera cannot hunt between two poses.
 */

// ---- Constants (mirror design spec 6.12.2 to 6.12.5; change both together) ---------------------

export const FRAMING = {
  /** 6.12.2 and 6.12.4: yaw offsets from the wall normal, tried in this order. */
  yawOffsetsDeg: [35, 45, 52],
  /** 6.12.2: pitch while framed stays in this range. */
  pitchMinDeg: 8,
  pitchMaxDeg: 20,
  /** 6.12.2: the saved pitch is the default (14), so frame at 12. */
  savedDefaultPitchDeg: 14,
  framedDefaultPitchDeg: 12,
  /** 6.12.4 step 2: second pass with the camera looking a little more down. */
  raisedPitchDeg: 20,
  /** v1.3: phone landscape only, a further pass after the pitch 20 list. */
  landscapePitchDeg: 26,
  /** 6.12.2: boom search range, metres. */
  boomMin: 2.5,
  boomMax: 6.5,
  boomStep: 0.05,
  /** 6.12.5: distance kept from an outer wall, and from the ceiling. */
  wallMargin: 0.3,
  ceilingMargin: 0.3,
  /** 6.12.4: rectangles are grown by this many CSS px before the overlap tests. */
  growPx: 8,
  /** Height of a nominal character, for the label anchor (0.35 m above the head, scaled). */
  nominalHeight: 1.7,
  labelAbove: 0.35,
} as const;

const FORESHORTEN_AT_35 = 0.82;

/**
 * The caption card's width and edge margin, mirrored from design spec 3.5 and tokens.css
 * (`--card-width-landscape` clamp(16rem, 30vw, 22rem), `--card-width-wide` clamp(18rem, 28vw, 26rem),
 * `--card-min-width` 16rem; edge margin `--hud-margin` 12 px on phone landscape, 24 px on wide).
 * They set the framing's right bound R (6.12.2, v1.4). Change both together.
 */
export const CARD = {
  rem: 16,
  landscape: { minRem: 16, vw: 0.3, maxRem: 22, edge: 12 },
  wide: { minRem: 18, vw: 0.28, maxRem: 26, edge: 24 },
  /** The framing keeps this clear of the card's left edge. */
  gap: 8,
  /** Below this R the Guide is dropped from the fit set before narrowing further. */
  dropGuideBelow: 0.55,
} as const;

/** Left edge of the card in CSS px for the landscape and wide docks. */
export function cardLeftEdge(cls: ViewportClass, width: number): number {
  if (cls === 'phone-portrait') return 0;
  const c = cls === 'phone-landscape' ? CARD.landscape : CARD.wide;
  const cardW = Math.min(
    Math.min(width, Math.max(c.minRem * CARD.rem, Math.min(width * c.vw, c.maxRem * CARD.rem))),
    width,
  );
  return width - c.edge - cardW;
}

/** The framing's right bound R as a fraction of the width (6.12.2, v1.4). */
export function framingRightBound(cls: ViewportClass, width: number): number {
  if (cls === 'phone-portrait') return SPECS[cls].safe.x1;
  return Math.min(SPECS[cls].safe.x1, (cardLeftEdge(cls, width) - CARD.gap) / width);
}

/** The widest picture the layout hangs (LAYOUT.photoBoxWidth). */
const PICTURE_BOX_WIDTH = 1.6;

/** Half-extent of the box drawn round a standing character (shared with the published rects). */
export const CHARACTER_BOX_RADIUS = 0.3;

/** The Guide yields (sidesteps) inside a 1.0 m wide corridor from the camera to the Visitor. */
const GUIDE_CORRIDOR_HALF_WIDTH = 0.5;

interface ClassSpec {
  /** Safe rectangle for the fit set, as fractions of the viewport (x from left, y from top). */
  safe: { x0: number; x1: number; y0: number; y1: number };
  /** Picture width on screen, as a fraction of the viewport width (min) and of the reference (max). */
  pictureMin: number;
  pictureMaxOf: 'viewport' | 'safe';
  pictureMax: number;
  /** Portrait only: the picture's height is at most this fraction of the safe height. */
  pictureMaxHeightOfSafe: number | null;
  /** Visitor height on screen, as a fraction of the viewport height. */
  visitor: { min: number; max: number };
  /** The caption card's default dock, as fractions of the viewport (3.5, 6.12.2). */
  dock: { x0: number; x1: number; y0: number; y1: number };
}

/** Design spec 6.12.2 table. */
const SPECS: Record<ViewportClass, ClassSpec> = {
  'phone-portrait': {
    safe: { x0: 0.05, x1: 0.95, y0: 0.3, y1: 0.74 },
    pictureMin: 0.45,
    pictureMaxOf: 'viewport',
    pictureMax: 0.9,
    pictureMaxHeightOfSafe: 0.85,
    visitor: { min: 0.18, max: 0.34 },
    dock: { x0: 0, x1: 1, y0: 0, y1: 0.3 },
  },
  'phone-landscape': {
    safe: { x0: 0.05, x1: 0.68, y0: 0.16, y1: 0.82 },
    pictureMin: 0.17,
    pictureMaxOf: 'safe',
    pictureMax: 0.6,
    pictureMaxHeightOfSafe: null,
    visitor: { min: 0.26, max: 0.5 },
    dock: { x0: 0.7, x1: 1, y0: 0, y1: 1 },
  },
  wide: {
    safe: { x0: 0.04, x1: 0.68, y0: 0.1, y1: 0.84 },
    pictureMin: 0.2,
    pictureMaxOf: 'safe',
    pictureMax: 0.6,
    pictureMaxHeightOfSafe: null,
    visitor: { min: 0.24, max: 0.48 },
    dock: { x0: 0.7, x1: 1, y0: 0, y1: 1 },
  },
};

// ---- Types -------------------------------------------------------------------------------------

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface FramingActor {
  x: number;
  z: number;
  /** Head-top height in metres. */
  height: number;
}

export interface FramingInput {
  viewport: { width: number; height: number };
  picture: {
    /** The four outer corners of the frame, world space. */
    corners: readonly Point3[];
    /** Wall normal pointing into the room, plan. */
    normal: Vec2;
  };
  visitor: FramingActor;
  /** The Guide's destination spot, not where she stands now (6.12 trigger). */
  guide: FramingActor;
  /** Size of each name label in CSS px. */
  labelSize: { visitor: { w: number; h: number }; guide: { w: number; h: number } };
  /** The user's pose just before the move: look yaw and pitch (radians). */
  saved: { yaw: number; pitch: number };
  /** Outer walls and the lectern: a candidate may not cross them (6.12.5). */
  hardColliders: readonly Aabb[];
  /** Partition colliders (the segments either side of each doorway). */
  partitionColliders: readonly Aabb[];
  ceilingHeight: number;
  /** Test aid: when set, the solver appends why each candidate failed. */
  trace?: string[];
}

export type FramingRects = {
  picture: Rect;
  visitor: Rect | null;
  guide: Rect | null;
  visitorLabel: Rect | null;
  guideLabel: Rect | null;
};

export interface FramingSolution {
  /** Look yaw, heading convention: the camera looks along (sin yaw, cos yaw). */
  yaw: number;
  pitch: number;
  boom: number;
  /** The point the camera orbits and looks at. */
  pivot: Point3;
  /** Signed yaw offset from the wall normal, degrees. Positive turns the camera's heading up. */
  yawOffsetDeg: number;
  pitchDeg: number;
  /** True when the Guide could not be kept in the fit set (6.12.2). */
  guideDropped: boolean;
  /** True when a candidate was chosen by least overlap (6.12.4 step 3). */
  relaxed: boolean;
  /** Screen rectangles at this pose, CSS px. */
  rects: FramingRects;
  /** Share of the picture inside the viewport and not covered by a character or label. */
  pictureVisibleFraction: number;
  /** Visitor's height on screen as a fraction of the viewport height. */
  visitorHeightFraction: number;
  /** Camera position, for the tests and the hand-off to the rig. */
  camera: Point3;
}

// ---- Camera model ------------------------------------------------------------------------------

export interface CameraModel {
  px: number;
  py: number;
  pz: number;
  fx: number;
  fy: number;
  fz: number;
  rx: number;
  rz: number;
  ux: number;
  uy: number;
  uz: number;
  tanHalf: number;
  aspect: number;
  /** The constant view offset in NDC (`2 * viewOffsetY`). */
  offsetNdc: number;
  width: number;
  height: number;
}

const NEAR_DEPTH = 0.05;

/** A camera standing at `position` looking along yaw and pitch (radians), as `camera.lookAt` does. */
export function makeCameraModel(
  position: Point3,
  yaw: number,
  pitch: number,
  fovDeg: number,
  viewOffsetY: number,
  width: number,
  height: number,
): CameraModel {
  const cp = Math.cos(pitch);
  const fx = Math.sin(yaw) * cp;
  const fy = -Math.sin(pitch);
  const fz = Math.cos(yaw) * cp;
  // right = forward x up(0,1,0), normalised; up = right x forward.
  const rl = Math.hypot(fx, fz) || 1;
  const rx = -fz / rl;
  const rz = fx / rl;
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  return {
    px: position.x,
    py: position.y,
    pz: position.z,
    fx,
    fy,
    fz,
    rx,
    rz,
    ux,
    uy,
    uz,
    tanHalf: Math.tan((fovDeg * Math.PI) / 360),
    aspect: width / Math.max(1, height),
    offsetNdc: viewOffsetY * 2,
    width,
    height,
  };
}

/** Projects a world point to CSS px. Returns false for a point behind (or too near) the camera. */
export function projectToScreen(
  m: CameraModel,
  x: number,
  y: number,
  z: number,
  out: { x: number; y: number },
): boolean {
  const dx = x - m.px;
  const dy = y - m.py;
  const dz = z - m.pz;
  const depth = dx * m.fx + dy * m.fy + dz * m.fz;
  if (depth < NEAR_DEPTH) return false;
  const right = dx * m.rx + dz * m.rz;
  const up = dx * m.ux + dy * m.uy + dz * m.uz;
  const ndcX = right / depth / (m.tanHalf * m.aspect);
  const ndcY = up / depth / m.tanHalf + m.offsetNdc;
  out.x = (ndcX * 0.5 + 0.5) * m.width;
  out.y = (0.5 - ndcY * 0.5) * m.height;
  return true;
}

const scratch = { x: 0, y: 0 };

function boundsOf(
  m: CameraModel,
  points: ReadonlyArray<readonly [number, number, number]>,
): Rect | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const p of points) {
    if (!projectToScreen(m, p[0], p[1], p[2], scratch)) return null;
    if (scratch.x < left) left = scratch.x;
    if (scratch.x > right) right = scratch.x;
    if (scratch.y < top) top = scratch.y;
    if (scratch.y > bottom) bottom = scratch.y;
  }
  return { left, top, right, bottom };
}

/**
 * The four points that bound a standing character on screen: left and right of the feet and of
 * the head top, a body radius either side along the camera's right (plan). A thin bound, so a
 * character near the camera is not inflated by the depth of a box. The scene's published
 * rectangles use the same shape (`characterPoints`), so the solver, the caption card and QA agree.
 */
export function characterPoints(
  x: number,
  z: number,
  height: number,
  rightX: number,
  rightZ: number,
): Array<[number, number, number]> {
  const l = Math.hypot(rightX, rightZ) || 1;
  const dx = (rightX / l) * CHARACTER_BOX_RADIUS;
  const dz = (rightZ / l) * CHARACTER_BOX_RADIUS;
  return [
    [x - dx, 0, z - dz],
    [x + dx, 0, z + dz],
    [x - dx, height, z - dz],
    [x + dx, height, z + dz],
  ];
}

/** Height of a name label above the feet, as the scene places it (0.35 m above the head, scaled). */
export function labelAnchorHeight(height: number): number {
  return height + (FRAMING.labelAbove * height) / FRAMING.nominalHeight;
}

function labelRect(
  m: CameraModel,
  actor: FramingActor,
  size: { w: number; h: number },
): Rect | null {
  if (!projectToScreen(m, actor.x, labelAnchorHeight(actor.height), actor.z, scratch)) return null;
  return {
    left: scratch.x - size.w / 2,
    top: scratch.y - size.h / 2,
    right: scratch.x + size.w / 2,
    bottom: scratch.y + size.h / 2,
  };
}

/** Compute the screen rectangles of the picture, both characters and both labels. */
export function projectFramingRects(
  m: CameraModel,
  input: Pick<FramingInput, 'picture' | 'visitor' | 'guide' | 'labelSize'>,
): { picture: Rect | null } & Omit<FramingRects, 'picture'> {
  const pic = boundsOf(
    m,
    input.picture.corners.map((c) => [c.x, c.y, c.z] as const),
  );
  const body = (a: FramingActor) => boundsOf(m, characterPoints(a.x, a.z, a.height, m.rx, m.rz));
  return {
    picture: pic,
    visitor: body(input.visitor),
    guide: body(input.guide),
    visitorLabel: labelRect(m, input.visitor, input.labelSize.visitor),
    guideLabel: labelRect(m, input.guide, input.labelSize.guide),
  };
}

// ---- Rectangle helpers -------------------------------------------------------------------------

export function rectArea(r: Rect): number {
  return Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
}

export function growRect(r: Rect, by: number): Rect {
  return { left: r.left - by, top: r.top - by, right: r.right + by, bottom: r.bottom + by };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function clip(a: Rect, b: Rect): Rect | null {
  const r = {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  };
  return r.right > r.left && r.bottom > r.top ? r : null;
}

/** Area of the union of rectangles (coordinate compression; callers pass four at most). */
export function unionArea(rects: readonly Rect[]): number {
  if (rects.length === 0) return 0;
  const xs = [...new Set(rects.flatMap((r) => [r.left, r.right]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i] as number;
    const x1 = xs[i + 1] as number;
    const spans = rects
      .filter((r) => r.left < x1 && r.right > x0)
      .map((r) => [r.top, r.bottom] as const)
      .sort((a, b) => a[0] - b[0]);
    let covered = 0;
    let end = -Infinity;
    for (const [top, bottom] of spans) {
      const from = Math.max(top, end);
      if (bottom > from) covered += bottom - from;
      end = Math.max(end, bottom);
    }
    area += covered * (x1 - x0);
  }
  return area;
}

/**
 * Share of the picture rectangle that is inside the viewport and not covered by any cover
 * rectangle (a character or a label). 0 when the picture is not on screen. No pixels are read.
 */
export function pictureVisibleFraction(
  picture: Rect | null,
  viewport: { width: number; height: number },
  covers: ReadonlyArray<Rect | null>,
): number {
  if (!picture) return 0;
  const total = rectArea(picture);
  if (total <= 0) return 0;
  const inside = clip(picture, { left: 0, top: 0, right: viewport.width, bottom: viewport.height });
  if (!inside) return 0;
  const clipped: Rect[] = [];
  for (const c of covers) {
    const part = c ? clip(inside, c) : null;
    if (part) clipped.push(part);
  }
  return Math.max(0, (rectArea(inside) - unionArea(clipped)) / total);
}

// ---- Solver ------------------------------------------------------------------------------------

const DEG = Math.PI / 180;

interface Evaluation {
  /** Fit, sizes, walls and the Guide corridor all pass (the "base" of 6.12.4 step 3). */
  base: boolean;
  /** Base plus clear of obstruction plus the dock (6.12.4 tests). */
  strict: boolean;
  overlap: number;
  solution: FramingSolution | null;
}

const FAIL: Evaluation = { base: false, strict: false, overlap: Infinity, solution: null };

/** Saved pitch limited to 8 to 20 degrees, with the default 14 becoming 12 (6.12.2). */
export function framedPitchDeg(savedPitchRad: number): number {
  const deg = savedPitchRad / DEG;
  if (Math.abs(deg - FRAMING.savedDefaultPitchDeg) < 0.5) return FRAMING.framedDefaultPitchDeg;
  return clamp(deg, FRAMING.pitchMinDeg, FRAMING.pitchMaxDeg);
}

export function solveFraming(input: FramingInput): FramingSolution | null {
  const { width, height } = input.viewport;
  const cls = classifyViewport(width, height);
  const spec = SPECS[cls];
  const comp = computeComposition(width, height);

  const safe: Rect = {
    left: spec.safe.x0 * width,
    top: spec.safe.y0 * height,
    right: framingRightBound(cls, width) * width,
    bottom: spec.safe.y1 * height,
  };
  // Portrait: the dock ends where the safe rectangle starts, less the 8 px growth, so a picture at
  // the top of the safe rectangle is not counted as touching it. Landscape and wide: the card's
  // real left edge.
  const dock: Rect = {
    left: cls === 'phone-portrait' ? 0 : cardLeftEdge(cls, width),
    top: spec.dock.y0 * height,
    right: width,
    bottom: cls === 'phone-portrait' ? safe.top - FRAMING.growPx : spec.dock.y1 * height,
  };
  const safeW = safe.right - safe.left;
  const safeH = safe.bottom - safe.top;
  // The table's widths are for a picture filling the 1.6 m box; a narrower (portrait) picture has
  // its minimum scaled down in proportion, or it could never meet it beside two characters.
  const worldWidth = Math.max(
    ...input.picture.corners.map((a) =>
      Math.max(...input.picture.corners.map((b) => Math.hypot(a.x - b.x, a.z - b.z))),
    ),
  );
  // 6.12.2: at the intended 35 degree view the picture is foreshortened to about 82% of its full
  // width, so the minimum (stated for the full width) is scaled the same way.
  const widthScale = clamp(worldWidth / PICTURE_BOX_WIDTH, 0.3, 1);
  const pictureMinW = spec.pictureMin * width * widthScale * FORESHORTEN_AT_35;
  const pictureMaxW = spec.pictureMax * (spec.pictureMaxOf === 'viewport' ? width : safeW);
  const pictureMaxH =
    spec.pictureMaxHeightOfSafe === null ? Infinity : spec.pictureMaxHeightOfSafe * safeH;
  const visitorMin = spec.visitor.min * height;
  const visitorMax = spec.visitor.max * height;

  // Aim: the centre of the box holding the picture corners and both characters, feet to head top.
  const pts: Point3[] = [...input.picture.corners];
  for (const a of [input.visitor, input.guide]) {
    pts.push({ x: a.x, y: 0, z: a.z }, { x: a.x, y: a.height, z: a.z });
  }
  const lo = { x: Infinity, y: Infinity, z: Infinity };
  const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of pts) {
    lo.x = Math.min(lo.x, p.x);
    lo.y = Math.min(lo.y, p.y);
    lo.z = Math.min(lo.z, p.z);
    hi.x = Math.max(hi.x, p.x);
    hi.y = Math.max(hi.y, p.y);
    hi.z = Math.max(hi.z, p.z);
  }
  const aim: Point3 = { x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2, z: (lo.z + hi.z) / 2 };

  const n = input.picture.normal;
  const normalHeading = Math.atan2(n.x, n.z);
  // The picture's wall surface: any corner is on it (frame depth aside).
  const wallPoint: Vec2 = {
    x: input.picture.corners.reduce((s, c) => s + c.x, 0) / input.picture.corners.length,
    z: input.picture.corners.reduce((s, c) => s + c.z, 0) / input.picture.corners.length,
  };
  const cornerPlan: Vec2[] = input.picture.corners.map((c) => ({ x: c.x, z: c.z }));
  const visitorPlan: Vec2 = { x: input.visitor.x, z: input.visitor.z };
  const guidePlan: Vec2 = { x: input.guide.x, z: input.guide.z };
  const allWalls = [...input.hardColliders, ...input.partitionColliders];

  const evaluate = (side: 1 | -1, offsetDeg: number, pitchDeg: number): Evaluation => {
    const azimuth = normalHeading + side * offsetDeg * DEG;
    const dir: Vec2 = { x: Math.sin(azimuth), z: Math.cos(azimuth) };
    const lookYaw = azimuth + Math.PI;
    const pitch = pitchDeg * DEG;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const right: Vec2 = { x: -Math.cos(lookYaw), z: Math.sin(lookYaw) }; // forward x up, plan

    interface Placement {
      boom: number;
      pivot: Point3;
      cam: Point3;
      model: CameraModel;
      rects: ReturnType<typeof projectFramingRects>;
    }

    /** Camera for a boom, shifted sideways so the group centres in the safe rectangle. */
    const place = (boom: number, includeGuide: boolean): Placement | null => {
      let shift = 0;
      let lift = 0;
      let placement: Placement | null = null;
      // Place, measure, shift. Only the pivot moves sideways: yaw, pitch, FOV and the view offset
      // never change. Three passes converge to well under a pixel.
      for (let pass = 0; pass < 3; pass++) {
        const pivot: Point3 = {
          x: aim.x + right.x * shift,
          y: aim.y + lift,
          z: aim.z + right.z * shift,
        };
        const cam: Point3 = {
          x: pivot.x + dir.x * boom * cp,
          y: pivot.y + boom * sp,
          z: pivot.z + dir.z * boom * cp,
        };
        const model = makeCameraModel(
          cam,
          lookYaw,
          pitch,
          comp.fovDeg,
          comp.viewOffsetY,
          width,
          height,
        );
        const rects = projectFramingRects(model, input);
        placement = { boom, pivot, cam, model, rects };
        if (pass === 2) break;
        const fit = fitRect(rects, includeGuide);
        if (!fit) break;
        const metres =
          (((safe.left + safe.right) / 2 - (fit.left + fit.right) / 2) / width) *
          2 *
          boom *
          model.tanHalf *
          model.aspect;
        // To move the group right on screen, move the pivot left.
        shift -= metres;
        // The same for height: lowering the pivot lifts the group on screen.
        lift -=
          (((fit.top + fit.bottom) / 2 - (safe.top + safe.bottom) / 2) / height) *
          2 *
          boom *
          model.tanHalf;
      }
      return placement;
    };

    /** The wall rules of 6.12.5. False means this boom, and every longer one, is out. */
    const wallsAllow = (pl: Placement): boolean => {
      const { cam, pivot } = pl;
      if (cam.y > input.ceilingHeight - FRAMING.ceilingMargin || cam.y < 0.3) return false;
      const camPlan: Vec2 = { x: cam.x, z: cam.z };
      const pivotPlan: Vec2 = { x: pivot.x, z: pivot.z };
      // On the room side of the picture's wall, and not inside any wall's thickness.
      if ((camPlan.x - wallPoint.x) * n.x + (camPlan.z - wallPoint.z) * n.z < 0.3) return false;
      for (const box of allWalls) if (pointInAabb(camPlan, inflateAabb(box, 0.15))) return false;
      // Outer walls: the aim-to-camera segment stays inside them, with a margin. The framing never
      // shortens the boom to squeeze in, so a candidate needing more than the wall allows fails.
      const horizontal = Math.hypot(camPlan.x - pivotPlan.x, camPlan.z - pivotPlan.z);
      if (horizontal > 0) {
        const hit = firstHitDistance(
          pivotPlan,
          dir,
          horizontal,
          input.hardColliders,
          FRAMING.wallMargin,
        );
        if (hit < horizontal - 1e-6) return false;
      }
      // Partitions between the camera and the picture: the candidate fails. The four corners are
      // tested, so a doorway counts as clear only when it shows the whole picture.
      for (const corner of cornerPlan) {
        if (!segmentClear(camPlan, corner, input.partitionColliders, 0)) return false;
      }
      return true;
    };

    const why = (msg: string): Evaluation => {
      input.trace?.push(`${side * offsetDeg}/${pitchDeg}: ${msg}`);
      return FAIL;
    };

    const run = (includeGuide: boolean): Evaluation => {
      // Shortest boom at which the fit set is inside the safe rectangle. The Visitor's maximum
      // height pushes the boom out, but the picture's minimum width has priority over it (6.12.2:
      // the picture never shrinks below its minimum), so the boom stops growing there.
      let chosen: Placement | null = null;
      let chosenVisitorH = 0;
      let reason = 'nothing tried';
      for (let boom = FRAMING.boomMin; boom <= FRAMING.boomMax + 1e-9; boom += FRAMING.boomStep) {
        const pl = place(boom, includeGuide);
        if (!pl) break;
        if (!wallsAllow(pl)) {
          input.trace?.push(
            `${side * offsetDeg}/${pitchDeg}: wall at boom ${boom.toFixed(2)} (guide ${includeGuide})`,
          );
          break; // longer booms only get worse
        }
        const picture = pl.rects.picture;
        const fit = fitRect(pl.rects, includeGuide);
        if (!picture || !fit || !contains(safe, fit)) {
          reason = `outside safe at ${boom.toFixed(2)}: fit ${fit ? [fit.left, fit.top, fit.right, fit.bottom].map(Math.round).join(',') : 'none'} picture ${picture ? Math.round(picture.right - picture.left) : 'none'}`;
          if (chosen) break;
          continue;
        }
        const pictureW = picture.right - picture.left;
        const pictureH = picture.bottom - picture.top;
        if (pictureW > pictureMaxW + 1e-6 || pictureH > pictureMaxH + 1e-6) {
          reason = `picture too big at ${boom.toFixed(2)}`;
          if (chosen) break;
          continue;
        }
        if (pictureW < pictureMinW - 1e-6) {
          reason = `picture too small at ${boom.toFixed(2)} (${Math.round(pictureW)} < ${Math.round(pictureMinW)})`;
          break;
        }
        const feet = projectToScreen(pl.model, input.visitor.x, 0, input.visitor.z, scratch)
          ? scratch.y
          : NaN;
        const head = projectToScreen(
          pl.model,
          input.visitor.x,
          input.visitor.height,
          input.visitor.z,
          scratch,
        )
          ? scratch.y
          : NaN;
        // Normalised to the 1.7 m reference Visitor (v1.3), so a tall or short one is not penalised.
        const visitorH = ((feet - head) * FRAMING.nominalHeight) / input.visitor.height;
        if (Number.isNaN(visitorH)) continue;
        chosen = pl;
        chosenVisitorH = visitorH;
        if (visitorH <= visitorMax + 1e-6) break;
      }
      if (!chosen) return why(`no boom fits (guide ${includeGuide}): ${reason}`);
      // The Visitor below her minimum fails this fit set (the Guide is dropped next, 6.12.2).
      if (chosenVisitorH < visitorMin - 1e-6)
        return why(
          `visitor too small ${chosenVisitorH.toFixed(0)} < ${visitorMin.toFixed(0)} at boom ${chosen.boom.toFixed(2)}`,
        );

      const { cam, pivot, rects, boom } = chosen;
      const picture = rects.picture as Rect;
      // The Guide must not stand in the camera-to-Visitor corridor: she would yield (sidestep).
      const corridor = distToSegment(guidePlan, { x: cam.x, z: cam.z }, visitorPlan);
      if (corridor.dist < GUIDE_CORRIDOR_HALF_WIDTH && corridor.t < 0.97)
        return why('guide corridor');

      // Obstruction and dock (6.12.4).
      const g = FRAMING.growPx;
      const visitorCovers = [rects.visitor, rects.visitorLabel].filter(
        (r): r is Rect => r !== null,
      );
      const guideCovers = [rects.guide, rects.guideLabel].filter((r): r is Rect => r !== null);
      const covers = [...visitorCovers, ...guideCovers];
      const clear = !covers.some((r) => intersects(growRect(r, g), picture));
      const overlap = unionArea(
        covers.map((r) => clip(picture, r)).filter((r): r is Rect => r !== null),
      );
      // The Guide's rectangles only count for the dock when she is in the fit set.
      const dockGrown = growRect(dock, g);
      const dockClear =
        !intersects(dockGrown, picture) &&
        !(includeGuide ? covers : visitorCovers).some((r) => intersects(dockGrown, r));

      const solution: FramingSolution = {
        yaw: lookYaw,
        pitch,
        boom,
        pivot,
        yawOffsetDeg: side * offsetDeg,
        pitchDeg,
        guideDropped: !includeGuide,
        relaxed: false,
        rects: {
          picture,
          visitor: rects.visitor,
          guide: rects.guide,
          visitorLabel: rects.visitorLabel,
          guideLabel: rects.guideLabel,
        },
        pictureVisibleFraction: pictureVisibleFraction(picture, input.viewport, covers),
        visitorHeightFraction: chosenVisitorH / height,
        camera: cam,
      };
      return { base: true, strict: clear && dockClear, overlap, solution };
    };

    // Fit set in priority order: picture, Visitor, Guide. Drop the Guide first (6.12.2).
    // A narrow framing column (R under 55%) drops the Guide from the fit set at once (v1.4).
    const withGuide = framingRightBound(cls, width) < CARD.dropGuideBelow ? FAIL : run(true);
    if (withGuide.strict) return withGuide;
    // Not clear of the picture (or not fitting): try again without the Guide in the fit set, which
    // lets her sit partly off screen, and keep whichever leaves less of the picture covered.
    const without = run(false);
    if (!withGuide.base) return without;
    if (without.strict || (without.base && without.overlap < withGuide.overlap)) return without;
    return withGuide;
  };

  // Candidate order (6.12.4): the side nearest the camera's current azimuth first, the three yaw
  // offsets, then the same list with the pitch raised to 20 degrees.
  const currentAzimuth = input.saved.yaw + Math.PI;
  const sideAt = (side: 1 | -1) =>
    Math.abs(angleDiff(currentAzimuth, normalHeading + side * FRAMING.yawOffsetsDeg[0]! * DEG));
  const sides: Array<1 | -1> = sideAt(1) <= sideAt(-1) ? [1, -1] : [-1, 1];
  const basePitch = framedPitchDeg(input.saved.pitch);
  const pitches: number[] =
    basePitch === FRAMING.raisedPitchDeg ? [basePitch] : [basePitch, FRAMING.raisedPitchDeg];
  if (cls === 'phone-landscape') pitches.push(FRAMING.landscapePitchDeg);

  let best: Evaluation | null = null;
  for (const pitchDeg of pitches) {
    for (const side of sides) {
      for (const offsetDeg of FRAMING.yawOffsetsDeg) {
        const result = evaluate(side, offsetDeg, pitchDeg);
        if (result.strict) return result.solution;
        if (result.base && (!best || result.overlap < best.overlap)) best = result;
      }
    }
  }
  // Step 3: the least overlap of the picture, as long as it is fully in the safe rectangle and no
  // wall rule is broken (both are part of `base`). The caller moves a label that still overlaps.
  if (best?.solution) return { ...best.solution, relaxed: true };
  // Step 4: nothing works, so the follow camera stays.
  return null;
}

// ---- Fit helpers -------------------------------------------------------------------------------

function union(a: Rect, b: Rect | null): Rect {
  if (!b) return a;
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

/** The bounding rectangle of the fit set: picture, Visitor with label, and optionally the Guide. */
function fitRect(
  rects: ReturnType<typeof projectFramingRects>,
  includeGuide: boolean,
): Rect | null {
  if (!rects.picture || !rects.visitor) return null;
  let r = union(rects.picture, rects.visitor);
  r = union(r, rects.visitorLabel);
  if (includeGuide) {
    if (!rects.guide) return null;
    r = union(r, rects.guide);
    r = union(r, rects.guideLabel);
  }
  return r;
}

function contains(outer: Rect, inner: Rect): boolean {
  const e = 0.5;
  return (
    inner.left >= outer.left - e &&
    inner.right <= outer.right + e &&
    inner.top >= outer.top - e &&
    inner.bottom <= outer.bottom + e
  );
}
