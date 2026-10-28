/**
 * Procedural surface primitives for the avatar kit: lofts, ellipsoids, tapered tubes and
 * hairline-following shells. Everything is authored in model space (feet at y = 0, facing +Z,
 * the character's left on +X) and returns indexed geometry with `position`, `normal` and `color`.
 *
 * Why not three.js primitives: a loft with per-ring colour lets one tube carry a sleeve and a
 * bare forearm, and a shell can follow a hairline, so each character is a few merged meshes
 * instead of dozens of draw calls (budget: 10 draw calls, 6,000 triangles).
 */
import { BufferAttribute, BufferGeometry, Color, Matrix4, Quaternion, Vector3 } from 'three';

export type Vec3Tuple = readonly [number, number, number];

export interface GridOptions {
  /** True for a full turn (the last column joins the first). False for an open arc. */
  closed: boolean;
  /** The last row collapses to one vertex (a dome). */
  poleTop?: boolean;
  /** The first row collapses to one vertex. */
  poleBottom?: boolean;
}

/**
 * Builds a surface from `rows` rings of `segs` columns. Rows must run from low to high so that
 * face normals point outwards when columns advance from +Z towards +X.
 * `point(row, col)` returns the position; `colour(row)` the row's vertex colour.
 */
export function gridSurface(
  rows: number,
  segs: number,
  point: (row: number, col: number) => Vec3Tuple,
  colour: (row: number) => Color,
  options: GridOptions,
): BufferGeometry {
  const cols = options.closed ? segs : segs + 1;
  const positions: number[] = [];
  const colours: number[] = [];
  const rowStart: number[] = [];
  const rowCount: number[] = [];

  for (let k = 0; k < rows; k++) {
    const isPole = (k === rows - 1 && options.poleTop) || (k === 0 && options.poleBottom);
    const n = isPole ? 1 : cols;
    rowStart.push(positions.length / 3);
    rowCount.push(n);
    const c = colour(k);
    for (let j = 0; j < n; j++) {
      const p = point(k, j);
      positions.push(p[0], p[1], p[2]);
      colours.push(c.r, c.g, c.b);
    }
  }

  const indices: number[] = [];
  const at = (k: number, j: number) => {
    const count = rowCount[k] ?? 1;
    if (count === 1) return rowStart[k] ?? 0;
    return (rowStart[k] ?? 0) + (options.closed ? j % cols : Math.min(j, cols - 1));
  };
  for (let k = 0; k < rows - 1; k++) {
    const lowPole = rowCount[k] === 1;
    const highPole = rowCount[k + 1] === 1;
    for (let j = 0; j < segs; j++) {
      if (lowPole && highPole) continue;
      if (highPole) {
        indices.push(at(k, j), at(k, j + 1), at(k + 1, 0));
      } else if (lowPole) {
        indices.push(at(k, 0), at(k + 1, j + 1), at(k + 1, j));
      } else {
        const a = at(k, j);
        const b = at(k, j + 1);
        const c = at(k + 1, j);
        const d = at(k + 1, j + 1);
        indices.push(a, b, c, b, d, c);
      }
    }
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------------------------
// Lofts
// ---------------------------------------------------------------------------------------------

export interface Ring {
  y: number;
  rx: number;
  rz: number;
  /** Ring centre. Defaults to 0. */
  cx?: number;
  cz?: number;
  colour?: Color;
  /** The ring collapses to a single point (a dome tip). Only valid first or last. */
  pole?: boolean;
}

export interface LoftOptions {
  segments?: number;
  colour?: Color;
  /** Angular range in radians, measured from +Z towards +X. Omit for a full turn. */
  arc?: readonly [number, number];
}

/** An elliptical loft through rings (any order; they are sorted by height). */
export function loft(ringsIn: readonly Ring[], options: LoftOptions = {}): BufferGeometry {
  const rings = [...ringsIn].sort((a, b) => a.y - b.y);
  const segs = options.segments ?? 14;
  const fallback = options.colour ?? new Color('#ffffff');
  const arc = options.arc;
  const first = rings[0];
  const last = rings[rings.length - 1];
  return gridSurface(
    rings.length,
    segs,
    (k, j) => {
      const r = rings[k] as Ring;
      if (r.pole) return [r.cx ?? 0, r.y, r.cz ?? 0];
      const theta = arc
        ? (arc[0] as number) + ((arc[1] - arc[0]) * j) / segs
        : (j / segs) * Math.PI * 2;
      return [(r.cx ?? 0) + r.rx * Math.sin(theta), r.y, (r.cz ?? 0) + r.rz * Math.cos(theta)];
    },
    (k) => rings[k]?.colour ?? fallback,
    { closed: !arc, poleBottom: first?.pole === true, poleTop: last?.pole === true },
  );
}

/** Linear interpolation of an elliptical loft's radii at height y (clamped to the ends). */
export function ringsAt(
  rings: readonly Ring[],
  y: number,
): { rx: number; rz: number; cx: number; cz: number } {
  const sorted = [...rings].filter((r) => !r.pole).sort((a, b) => a.y - b.y);
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];
  if (!lo || !hi) return { rx: 0, rz: 0, cx: 0, cz: 0 };
  if (y <= lo.y) return { rx: lo.rx, rz: lo.rz, cx: lo.cx ?? 0, cz: lo.cz ?? 0 };
  if (y >= hi.y) return { rx: hi.rx, rz: hi.rz, cx: hi.cx ?? 0, cz: hi.cz ?? 0 };
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i] as Ring;
    const b = sorted[i + 1] as Ring;
    if (y >= a.y && y <= b.y) {
      const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
      return {
        rx: a.rx + (b.rx - a.rx) * t,
        rz: a.rz + (b.rz - a.rz) * t,
        cx: (a.cx ?? 0) + ((b.cx ?? 0) - (a.cx ?? 0)) * t,
        cz: (a.cz ?? 0) + ((b.cz ?? 0) - (a.cz ?? 0)) * t,
      };
    }
  }
  return { rx: hi.rx, rz: hi.rz, cx: hi.cx ?? 0, cz: hi.cz ?? 0 };
}

// ---------------------------------------------------------------------------------------------
// Ellipsoids
// ---------------------------------------------------------------------------------------------

export interface EllipsoidOptions {
  segments?: number;
  rows?: number;
  colour: Color;
  /** Rotation applied about the centre (Euler XYZ, radians). */
  rotation?: Vec3Tuple;
}

/** A low-poly ellipsoid centred at `c` with radii `r`. */
export function ellipsoid(c: Vec3Tuple, r: Vec3Tuple, options: EllipsoidOptions): BufferGeometry {
  const segs = options.segments ?? 10;
  const rows = options.rows ?? 6; // latitude bands
  const g = gridSurface(
    rows + 1,
    segs,
    (k, j) => {
      const phi = -Math.PI / 2 + (k / rows) * Math.PI;
      const theta = (j / segs) * Math.PI * 2;
      const cp = Math.cos(phi);
      return [r[0] * cp * Math.sin(theta), r[1] * Math.sin(phi), r[2] * cp * Math.cos(theta)];
    },
    () => options.colour,
    { closed: true, poleBottom: true, poleTop: true },
  );
  return placeLocal(g, c, options.rotation);
}

function placeLocal(g: BufferGeometry, c: Vec3Tuple, rotation?: Vec3Tuple): BufferGeometry {
  const matrix = new Matrix4();
  if (rotation) {
    const qx = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rotation[0]);
    const qy = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rotation[1]);
    const qz = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rotation[2]);
    const q = qx.multiply(qy).multiply(qz);
    matrix.compose(new Vector3(c[0], c[1], c[2]), q, new Vector3(1, 1, 1));
  } else {
    matrix.makeTranslation(c[0], c[1], c[2]);
  }
  g.applyMatrix4(matrix);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Tapered tubes with colour bands
// ---------------------------------------------------------------------------------------------

export interface TubeBand {
  /** The band runs from the previous band's end to this value (0 at `from`, 1 at `to`). */
  until: number;
  colour: Color;
  /** Extra radius, so a sleeve or trouser leg stands proud of the skin (metres). */
  extra?: number;
}

export interface TubeOptions {
  from: Vec3Tuple;
  to: Vec3Tuple;
  radiusFrom: number;
  radiusTo: number;
  bands: readonly TubeBand[];
  /** Squash across the Z axis of the tube's local frame (thighs are a touch flatter). */
  depthScale?: number;
  capFrom?: boolean;
  capTo?: boolean;
  segments?: number;
  /** Extra mid rings for a gentle bulge, 0 for none. */
  bulge?: number;
}

const up = new Vector3(0, 1, 0);

/** A tapered tube between two points with hard colour bands and optional round caps. */
export function tube(o: TubeOptions): BufferGeometry {
  const from = new Vector3(...o.from);
  const to = new Vector3(...o.to);
  const dir = to.clone().sub(from);
  const length = dir.length();
  const segs = o.segments ?? 10;
  const depth = o.depthScale ?? 1;
  const bulge = o.bulge ?? 0;

  const radiusAt = (t: number) =>
    (o.radiusFrom + (o.radiusTo - o.radiusFrom) * t) * (1 + bulge * Math.sin(Math.PI * t));
  const bandAt = (t: number): TubeBand => {
    for (const b of o.bands) if (t <= b.until + 1e-9) return b;
    return o.bands[o.bands.length - 1] as TubeBand;
  };

  const eps = Math.min(0.0006 / Math.max(length, 1e-6), 0.01);
  const rings: Ring[] = [];
  let start = 0;
  o.bands.forEach((band, i) => {
    const end = Math.min(1, band.until);
    const a = i === 0 ? 0 : start + eps;
    const b = i === o.bands.length - 1 ? 1 : end - eps;
    const samples = Math.max(2, Math.round((b - a) * 4) + 1);
    for (let s = 0; s < samples; s++) {
      const t = a + ((b - a) * s) / (samples - 1);
      const r = radiusAt(t) + (band.extra ?? 0);
      rings.push({ y: t * length, rx: r, rz: r * depth, colour: band.colour });
    }
    start = end;
  });

  const capSteps = 3;
  if (o.capFrom) {
    const b = bandAt(0);
    const r = radiusAt(0) + (b.extra ?? 0);
    for (let s = 1; s <= capSteps; s++) {
      const a = (s / capSteps) * (Math.PI / 2);
      rings.push({
        y: -r * Math.sin(a),
        rx: r * Math.cos(a),
        rz: r * depth * Math.cos(a),
        colour: b.colour,
        pole: s === capSteps,
      });
    }
  }
  if (o.capTo) {
    const b = bandAt(1);
    const r = radiusAt(1) + (b.extra ?? 0);
    for (let s = 1; s <= capSteps; s++) {
      const a = (s / capSteps) * (Math.PI / 2);
      rings.push({
        y: length + r * Math.sin(a),
        rx: r * Math.cos(a),
        rz: r * depth * Math.cos(a),
        colour: b.colour,
        pole: s === capSteps,
      });
    }
  }

  const g = loft(rings, { segments: segs });
  const q = new Quaternion().setFromUnitVectors(up, dir.clone().normalize());
  g.applyMatrix4(new Matrix4().compose(from, q, new Vector3(1, 1, 1)));
  return g;
}

// ---------------------------------------------------------------------------------------------
// Hairline shells
// ---------------------------------------------------------------------------------------------

export interface ShellOptions {
  centre: Vec3Tuple;
  radii: Vec3Tuple;
  /**
   * Extra thickness added to every radius. A function receives the row fraction (0 at the lower
   * edge, 1 at the top) so a shell can thin out towards its edge (afro, beard).
   */
  thickness: number | ((rowFraction: number) => number);
  /** Latitude (radians above the equator) of the shell's lower edge at azimuth theta. */
  lower: (theta: number) => number;
  /** Latitude of the upper edge. Defaults to the pole (a full cap). */
  upper?: (theta: number) => number;
  /** Azimuth range. Omit for a full turn. */
  arc?: readonly [number, number];
  segments?: number;
  rows?: number;
  colour: Color;
}

/** An ellipsoid patch whose lower edge follows `lower(theta)`: hair caps, beards, stubble. */
export function shell(o: ShellOptions): BufferGeometry {
  const segs = o.segments ?? 20;
  const rows = o.rows ?? 5;
  const full = !o.upper;
  const thick = (k: number) =>
    typeof o.thickness === 'number' ? o.thickness : o.thickness(k / rows);
  return gridSurface(
    rows + 1,
    segs,
    (k, j) => {
      const theta = o.arc
        ? (o.arc[0] as number) + ((o.arc[1] - o.arc[0]) * j) / segs
        : (j / segs) * Math.PI * 2;
      const lo = o.lower(theta);
      const hi = o.upper ? o.upper(theta) : Math.PI / 2;
      const phi = lo + ((hi - lo) * k) / rows;
      const cp = Math.cos(phi);
      const t = thick(k);
      const rx = o.radii[0] + t;
      const ry = o.radii[1] + t;
      const rz = o.radii[2] + t;
      return [
        o.centre[0] + rx * cp * Math.sin(theta),
        o.centre[1] + ry * Math.sin(phi),
        o.centre[2] + rz * cp * Math.cos(theta),
      ];
    },
    () => o.colour,
    { closed: !o.arc, poleTop: full },
  );
}

/**
 * A hairline: latitude as a function of the angle from the front. `front`, `side` and `back` are
 * the latitudes (radians) at the forehead, above the ears and at the nape.
 */
export function hairline(front: number, side: number, back: number): (theta: number) => number {
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (theta) => {
    // Angle from the front, 0 to PI, symmetric left and right.
    const a = Math.abs(Math.atan2(Math.sin(theta), Math.cos(theta)));
    if (a < Math.PI / 2) return front + (side - front) * smooth(a / (Math.PI / 2));
    return side + (back - side) * smooth((a - Math.PI / 2) / (Math.PI / 2));
  };
}
