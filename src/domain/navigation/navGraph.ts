import type { MuseumLayout } from '../layout/types';
import { dist2, type Vec2 } from '../math/vec2';
import { resolveCircle } from './collision';
import { CHARACTER_RADIUS, circleIsFree, segmentClear, type Aabb } from './geometry';

/** A temporary start or goal node may link to graph nodes up to this far away. */
const MAX_LINK = 14;

interface Edge {
  to: number;
  cost: number;
}

/**
 * Navigation API for the Guide, the photo loader and the camera (ADR 0007).
 * A* over the layout's waypoint graph, then string-pulling. Everything is 2D and allocation-light.
 * The layout is axis-aligned and ours, so this is cheap; the API is kept narrow so a navmesh could
 * replace it for free-form themes.
 */
export class NavGraph {
  readonly colliders: readonly Aabb[];
  readonly bounds: Aabb;
  readonly radius: number;
  private readonly nodes: readonly { x: number; z: number }[];
  private readonly adjacency: Edge[][];

  constructor(
    layout: Pick<MuseumLayout, 'colliders' | 'bounds' | 'navGraph'>,
    radius: number = CHARACTER_RADIUS,
  ) {
    this.colliders = layout.colliders;
    this.bounds = layout.bounds;
    this.radius = radius;
    this.nodes = layout.navGraph.nodes;
    this.adjacency = layout.navGraph.nodes.map(() => []);
    for (const [a, b] of layout.navGraph.edges) {
      const na = this.nodes[a];
      const nb = this.nodes[b];
      if (!na || !nb) continue;
      const cost = Math.hypot(na.x - nb.x, na.z - nb.z);
      this.adjacency[a]?.push({ to: b, cost });
      this.adjacency[b]?.push({ to: a, cost });
    }
  }

  /** True if a character standing at p overlaps no wall and is inside the museum. */
  isWalkable(p: Vec2): boolean {
    return (
      p.x >= this.bounds.minX + this.radius &&
      p.x <= this.bounds.maxX - this.radius &&
      p.z >= this.bounds.minZ + this.radius &&
      p.z <= this.bounds.maxZ - this.radius &&
      circleIsFree(p, this.radius, this.colliders)
    );
  }

  /** A character-sized circle can travel the straight line a to b. */
  hasLineOfSight(a: Vec2, b: Vec2, margin: number = this.radius): boolean {
    return segmentClear(a, b, this.colliders, margin);
  }

  /** A point-sized sight line (labels, presentation zones): walls only, no character margin. */
  hasSightLine(a: Vec2, b: Vec2, margin = 0): boolean {
    return segmentClear(a, b, this.colliders, margin);
  }

  /** Nearest walkable point to p (pushes it out of walls and inside the bounds). */
  nearestWalkable(p: Vec2): Vec2 {
    const out = { x: p.x, z: p.z };
    resolveCircle(out, this.radius, this.colliders, this.bounds);
    return out;
  }

  /**
   * Shortest route from `from` to `to`, string-pulled. The result excludes `from` and ends at `to`
   * (or the nearest walkable point to it). Returns null only if the graph cannot connect them.
   */
  findPath(from: Vec2, to: Vec2): Vec2[] | null {
    const goal = this.isWalkable(to) ? to : this.nearestWalkable(to);
    if (this.hasLineOfSight(from, goal)) return [{ x: goal.x, z: goal.z }];

    const n = this.nodes.length;
    const START = n;
    const GOAL = n + 1;
    const pos = (id: number): Vec2 =>
      id === START ? from : id === GOAL ? goal : (this.nodes[id] as Vec2);

    const startLinks: Edge[] = [];
    const goalLinks = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const p = this.nodes[i];
      if (!p) continue;
      const ds = dist2(from, p);
      if (ds <= MAX_LINK && this.hasLineOfSight(from, p as Vec2))
        startLinks.push({ to: i, cost: ds });
      const dg = dist2(goal, p);
      if (dg <= MAX_LINK && this.hasLineOfSight(goal, p as Vec2)) goalLinks.set(i, dg);
    }
    // A point wedged into a pocket (for example beside the lectern) may see no node. Link the two
    // nearest nodes anyway; collision sliding gets the character out and the next re-plan is clean.
    if (startLinks.length === 0) {
      for (const i of this.nearestNodes(from, 2))
        startLinks.push({ to: i, cost: dist2(from, this.nodes[i] as Vec2) });
    }
    if (goalLinks.size === 0) {
      for (const i of this.nearestNodes(goal, 2))
        goalLinks.set(i, dist2(goal, this.nodes[i] as Vec2));
    }
    if (startLinks.length === 0 || goalLinks.size === 0) return null;

    // A* with a Euclidean heuristic. Small graph: a linear scan of the open list is fine.
    const g = new Float64Array(n + 2).fill(Infinity);
    const f = new Float64Array(n + 2).fill(Infinity);
    const came = new Int32Array(n + 2).fill(-1);
    const closed = new Uint8Array(n + 2);
    const open: number[] = [START];
    g[START] = 0;
    f[START] = dist2(from, goal);

    while (open.length > 0) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) {
        if ((f[open[i] as number] as number) < (f[open[bi] as number] as number)) bi = i;
      }
      const cur = open[bi] as number;
      open[bi] = open[open.length - 1] as number;
      open.pop();
      if (cur === GOAL) break;
      closed[cur] = 1;

      const relax = (to: number, cost: number): void => {
        if (closed[to]) return;
        const ng = (g[cur] as number) + cost;
        if (ng < (g[to] as number)) {
          g[to] = ng;
          f[to] = ng + dist2(pos(to), goal);
          came[to] = cur;
          if (!open.includes(to)) open.push(to);
        }
      };

      if (cur === START) {
        for (const e of startLinks) relax(e.to, e.cost);
      } else {
        for (const e of this.adjacency[cur] ?? []) relax(e.to, e.cost);
        const toGoal = goalLinks.get(cur);
        if (toGoal !== undefined) relax(GOAL, toGoal);
      }
    }

    if (came[GOAL] === -1) return null;
    const ids: number[] = [];
    for (let c = GOAL; c !== -1; c = came[c] as number) ids.push(c);
    ids.reverse(); // START ... GOAL
    return this.stringPull(ids.map(pos));
  }

  private nearestNodes(p: Vec2, count: number): number[] {
    return this.nodes
      .map((n, i) => ({ i, d: dist2(p, n) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map((e) => e.i);
  }

  /** Length of the route, or Infinity when there is none. Used to rank photo downloads. */
  pathLength(from: Vec2, to: Vec2): number {
    const path = this.findPath(from, to);
    if (!path) return Infinity;
    let total = 0;
    let prev = from;
    for (const p of path) {
      total += dist2(prev, p);
      prev = p;
    }
    return total;
  }

  /** Skip any waypoint that has line of sight to a later one. Input includes the start point. */
  private stringPull(points: Vec2[]): Vec2[] {
    const out: Vec2[] = [];
    let anchor = 0;
    while (anchor < points.length - 1) {
      let next = anchor + 1;
      for (let j = points.length - 1; j > anchor + 1; j--) {
        if (this.hasLineOfSight(points[anchor] as Vec2, points[j] as Vec2)) {
          next = j;
          break;
        }
      }
      const p = points[next] as Vec2;
      out.push({ x: p.x, z: p.z });
      anchor = next;
    }
    return out;
  }
}
