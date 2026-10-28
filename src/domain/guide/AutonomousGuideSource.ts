import type {
  CharacterState,
  CharacterStateSource,
  Presentation,
  Vec3,
  WorldContext,
} from '../characters/characterState';
import { createCharacterState } from '../characters/createCharacterState';
import type { MuseumLayout, PhotoSlot } from '../layout/types';
import {
  angleDiff,
  clamp,
  dist2,
  distToSegment,
  dot2,
  forwardOf,
  headingOf,
  normalize2,
  turnTowards,
  type Vec2,
} from '../math/vec2';
import { moveCircle } from '../navigation/collision';
import type { NavGraph } from '../navigation/navGraph';
import type {
  PresentationDirector,
  PresentationIntent,
} from '../presentation/PresentationDirector';

export type GuideMode = 'follow' | 'approach' | 'present' | 'relocate';

/** Camera field of view, so the Guide can prefer spots on screen and reappear off screen. */
export interface GuideViewInfo {
  /** Vertical field of view in radians. */
  fovY: number;
  /** Viewport width divided by height. */
  aspect: number;
}

export interface GuideConfig {
  /** Start walking once farther than this from the Visitor (m). FR-31: stay within 2 to 5 m. */
  followFar: number;
  /** Step away if closer than this (m). */
  followNear: number;
  /** Distance of the follow spot from the Visitor (m). */
  followRadius: number;
  /** Reappear beside the Visitor beyond this distance (m). FR-31. */
  relocateDistance: number;
  /** Reappear after this long without progress (s). FR-31. */
  stuckSeconds: number;
  /** Walking speed, and catch-up speed (1.25 times the Visitor's top speed), m/s. */
  walkSpeed: number;
  catchUpSpeed: number;
  /** The caption appears on arrival or this long after the intent at the latest (s). */
  presentDelay: number;
  /** How far beside the Visitor the Guide stands to present (m). */
  presentOffset: number;
  /** Seconds the present gesture lasts. */
  gestureSeconds: number;
  /** Fade time for relocate and reduced-motion arrival (s). */
  fadeSeconds: number;
  /** Opacity while the Guide cannot sidestep out of the way. */
  yieldOpacity: number;
}

export const DEFAULT_GUIDE_CONFIG: Readonly<GuideConfig> = {
  followFar: 3.6,
  followNear: 1.8,
  followRadius: 2.6,
  relocateDistance: 8,
  stuckSeconds: 3,
  walkSpeed: 1.6,
  catchUpSpeed: 2.0,
  presentDelay: 1.5,
  presentOffset: 1.1,
  gestureSeconds: 2.4,
  fadeSeconds: 0.25,
  yieldOpacity: 0.35,
};

export interface GuideOptions {
  layout: MuseumLayout;
  nav: NavGraph;
  director: PresentationDirector;
  getView?: () => GuideViewInfo | null;
  config?: Partial<GuideConfig>;
}

const ARRIVAL = 0.3;
const WAYPOINT = 0.2;
const CORRIDOR_HALF_WIDTH = 0.25;
const OVERLAP_RADIUS = 0.6;
const DEG = Math.PI / 180;

function intentKey(intent: PresentationIntent): string {
  return intent.kind === 'photo' ? `photo:${intent.photoId}` : intent.kind;
}

/**
 * The autonomous Guide (FR-26 to FR-31, FR-62, architecture 6.5). Pure TypeScript: it reads the
 * Visitor and the camera from the world context, asks the director what to present, and produces
 * a CharacterState. States: follow, approach, present, relocate, with a yield overlay that
 * sidesteps out of the Visitor's path and the camera's line of sight.
 */
export class AutonomousGuideSource implements CharacterStateSource {
  readonly kind = 'autonomous' as const;

  private readonly layout: MuseumLayout;
  private readonly nav: NavGraph;
  private readonly director: PresentationDirector;
  private readonly getView: () => GuideViewInfo | null;
  private readonly cfg: GuideConfig;
  private readonly state: CharacterState;
  private readonly pos: Vec2;

  private mode: GuideMode = 'follow';
  private paused = false;
  private key = 'none';
  private intent: PresentationIntent = { kind: 'none' };
  private intentSince = 0;
  private presentationSet = false;
  private spot: Vec2 | null = null;
  private spotVisitor: Vec2 = { x: 0, z: 0 };

  private followTarget: Vec2 | null = null;
  private followCheck = 0;
  private sideSign = 1;

  private path: Vec2[] = [];
  private pathGoal: Vec2 | null = null;
  private replanTimer = 0;
  private stuckTimer = 0;
  private stuckAnchor: Vec2 = { x: 0, z: 0 };
  private moveSpeed = 0;
  private walking = false;

  private yieldTarget: Vec2 | null = null;
  private yieldBlocked = false;
  private fadeTarget = 1;

  private relocatePhase: 'out' | 'in' = 'out';
  private relocateAfter: 'follow' | 'approach' = 'follow';
  private gestureTimer = 0;
  private gesturePlayed = false;
  private lastVisitorHeading = Math.PI;
  private visitorVelocity: Vec2 = { x: 0, z: 0 };

  constructor(options: GuideOptions) {
    this.layout = options.layout;
    this.nav = options.nav;
    this.director = options.director;
    this.getView = options.getView ?? (() => null);
    this.cfg = { ...DEFAULT_GUIDE_CONFIG, ...options.config };
    const spawn = options.layout.spawn.guide;
    this.pos = { x: spawn.position.x, z: spawn.position.z };
    this.state = createCharacterState({
      position: { x: spawn.position.x, y: 0, z: spawn.position.z },
      heading: spawn.heading,
    });
  }

  // ---- Public API beyond CharacterStateSource ---------------------------------------------

  get currentMode(): GuideMode {
    return this.mode;
  }

  /** The presentation spot the Guide is heading for or standing at, if any. */
  get presentSpot(): Vec2 | null {
    return this.spot;
  }

  /** While paused (welcome screen, full-screen viewer) the Guide holds still. */
  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  read(): Readonly<CharacterState> {
    return this.state;
  }

  teleport(position: Vec3, heading: number): void {
    this.pos.x = position.x;
    this.pos.z = position.z;
    this.state.heading = heading;
    this.hardReset();
  }

  /** Instantly reappear beside the Visitor (replay, jump to a picture). */
  placeBesideVisitor(visitor: Vec2, cameraPos?: Vec2): void {
    const spot = this.chooseRelocateSpot(visitor, cameraPos ?? null);
    this.pos.x = spot.x;
    this.pos.z = spot.z;
    this.state.heading = headingOf(normalize2({ x: visitor.x - spot.x, z: visitor.z - spot.z }));
    this.hardReset();
  }

  // ---- Tick --------------------------------------------------------------------------------

  tick(dt: number, world: WorldContext): void {
    dt = clamp(dt, 0, 0.1);
    const s = this.state;
    s.timestamp = world.time * 1000;
    const visitorState = world.characters.get('visitor');
    if (!visitorState || this.paused || dt === 0) return;

    const V: Vec2 = { x: visitorState.position.x, z: visitorState.position.z };
    const cam: Vec2 = { x: world.camera.position.x, z: world.camera.position.z };
    const camKnown = Math.hypot(cam.x - V.x, cam.z - V.z) > 0.5;
    const reduced = world.reducedMotion;

    // Visitor velocity for path prediction (m/s).
    const vf = forwardOf(visitorState.heading);
    this.visitorVelocity = { x: vf.x * visitorState.speed, z: vf.z * visitorState.speed };
    this.lastVisitorHeading = visitorState.heading;

    // Intent from the director, and what changed.
    const intent = this.director.update(dt, V);
    this.handleIntentChange(intent, V, world.time, reduced, camKnown ? cam : null);

    if (this.mode === 'relocate') {
      this.tickRelocate(V, camKnown ? cam : null, reduced);
    } else {
      const d = dist2(this.pos, V);
      if (d > this.cfg.relocateDistance || this.stuckTimer >= this.cfg.stuckSeconds) {
        this.startRelocate(
          this.mode === 'follow' ? 'follow' : 'approach',
          reduced,
          V,
          camKnown ? cam : null,
        );
      }
    }

    let wantsToMove = false;
    if (this.mode === 'follow') wantsToMove = this.tickFollow(dt, V, camKnown ? cam : null);
    else if (this.mode === 'approach')
      wantsToMove = this.tickApproach(V, world.time, camKnown ? cam : null);
    else if (this.mode === 'present')
      wantsToMove = this.tickPresent(V, reduced, camKnown ? cam : null);

    if (this.mode !== 'relocate') {
      const yielding = this.tickYield(V, camKnown ? cam : null);
      wantsToMove = wantsToMove || yielding;
    }

    this.integrateMovement(dt, wantsToMove, V);
    this.updateOpacity(dt, reduced);
    this.updateGesture(dt, reduced);
  }

  // ---- Intent ------------------------------------------------------------------------------

  private handleIntentChange(
    intent: PresentationIntent,
    V: Vec2,
    time: number,
    reduced: boolean,
    cam: Vec2 | null,
  ): void {
    const key = intentKey(intent);
    if (key === this.key) {
      this.intent = intent;
      return;
    }
    this.key = key;
    this.intent = intent;
    this.intentSince = time;
    this.presentationSet = false;
    this.gesturePlayed = false;
    this.spot = null;
    this.path = [];
    this.pathGoal = null;

    if (intent.kind === 'none') {
      this.state.presentation = { kind: 'none' };
      this.state.gesture = 'none';
      this.gestureTimer = 0;
      if (this.mode === 'approach' || this.mode === 'present') this.mode = 'follow';
      else if (this.mode === 'relocate') this.relocateAfter = 'follow';
      this.followTarget = null;
      return;
    }

    // New intent: plan the spot beside the Visitor.
    this.spot = this.computePresentSpot(intent, V, cam);
    this.spotVisitor = { ...V };
    this.state.presentation = { kind: 'none' };
    this.state.gesture = 'none';
    this.gestureTimer = 0;

    if (this.mode === 'relocate') {
      this.relocateAfter = 'approach';
      return;
    }
    if (reduced && dist2(this.pos, this.spot) > ARRIVAL) {
      // FR-62: fade in beside the Visitor instead of walking across the room.
      this.pos.x = this.spot.x;
      this.pos.z = this.spot.z;
      this.state.teleportSeq += 1;
      this.state.opacity = 0;
      this.fadeTarget = 1;
      this.moveSpeed = 0;
      this.mode = 'present';
      this.beginPresenting(true);
      return;
    }
    this.mode = 'approach';
  }

  private presentationFor(intent: PresentationIntent): Presentation {
    if (intent.kind === 'photo') return { kind: 'photo', photoId: intent.photoId };
    if (intent.kind === 'finale') return { kind: 'finale' };
    return { kind: 'none' };
  }

  /** Publish the presentation (if not yet) and play the present gesture once per intent. */
  private beginPresenting(reduced: boolean): void {
    this.state.presentation = this.presentationFor(this.intent);
    this.presentationSet = true;
    if (!this.gesturePlayed) {
      this.gesturePlayed = true;
      this.gestureTimer = reduced ? 0 : this.cfg.gestureSeconds;
      this.state.gesture = reduced ? 'none' : 'present';
    }
  }

  // ---- Follow ------------------------------------------------------------------------------

  private tickFollow(dt: number, V: Vec2, cam: Vec2 | null): boolean {
    const d = dist2(this.pos, V);
    this.followCheck -= dt;

    if (this.followTarget) {
      // Re-choose when the target no longer fits the Visitor's new position.
      if (this.followCheck <= 0) {
        this.followCheck = 0.4;
        const td = dist2(this.followTarget, V);
        const fits =
          td >= this.cfg.followNear + 0.2 &&
          td <= this.cfg.followFar - 0.3 &&
          this.nav.hasSightLine(V, this.followTarget, 0.1);
        if (!fits) this.followTarget = this.chooseFollowSpot(V, cam);
      }
      if (dist2(this.pos, this.followTarget) < ARRIVAL) {
        this.followTarget = null;
        this.path = [];
        this.pathGoal = null;
        return false;
      }
      return true;
    }

    if (d > this.cfg.followFar || d < this.cfg.followNear) {
      this.followTarget = this.chooseFollowSpot(V, cam);
      this.followCheck = 0.4;
      return true;
    }
    return false;
  }

  private chooseFollowSpot(V: Vec2, cam: Vec2 | null): Vec2 {
    const visitorForward =
      this.visitorVelocity.x === 0 && this.visitorVelocity.z === 0
        ? forwardOf(this.lastVisitorHeading)
        : normalize2(this.visitorVelocity);
    const baseAzimuth = headingOf({ x: -visitorForward.x, z: -visitorForward.z });
    const view = this.getView();
    const camForward = cam ? normalize2({ x: V.x - cam.x, z: V.z - cam.z }) : null;
    const moving = Math.hypot(this.visitorVelocity.x, this.visitorVelocity.z) > 0.3;

    let best: Vec2 | null = null;
    let bestScore = Infinity;
    let bestSign = this.sideSign;
    for (const radius of [this.cfg.followRadius, this.cfg.followRadius + 0.6]) {
      for (let k = -6; k <= 6; k++) {
        const offset = k * 30 * DEG;
        const az = baseAzimuth + offset;
        const cand: Vec2 = { x: V.x + Math.sin(az) * radius, z: V.z + Math.cos(az) * radius };
        if (!this.nav.isWalkable(cand)) continue;
        if (!this.nav.hasSightLine(V, cand, 0.1)) continue;
        if (cam && this.inCorridor(cand, V, cam, 0.55)) continue;
        if (moving && this.inVisitorPath(cand, V, visitorForward)) continue;

        let score = Math.abs(angleDiff(this.sideSign * 55 * DEG, offset)) / (30 * DEG);
        score += dist2(cand, this.pos) * 0.15;
        score += (radius - this.cfg.followRadius) * 0.5;
        if (view && cam && camForward && !this.onScreen(cand, cam, camForward, view, 0.8))
          score += 3;
        if (score < bestScore) {
          bestScore = score;
          best = cand;
          bestSign = offset === 0 ? this.sideSign : Math.sign(offset);
        }
      }
    }
    if (best) {
      this.sideSign = bestSign;
      return best;
    }
    return this.nav.nearestWalkable({
      x: V.x - visitorForward.x * this.cfg.followRadius,
      z: V.z - visitorForward.z * this.cfg.followRadius,
    });
  }

  // ---- Approach and present ----------------------------------------------------------------

  private tickApproach(V: Vec2, time: number, cam: Vec2 | null): boolean {
    if (this.intent.kind === 'none') {
      this.mode = 'follow';
      return false;
    }
    // Keep the spot beside the Visitor if she shifts while the Guide walks over.
    if (!this.spot || dist2(V, this.spotVisitor) > 0.8) {
      this.spot = this.computePresentSpot(this.intent, V, cam);
      this.spotVisitor = { ...V };
    }
    if (dist2(this.pos, this.spot) < ARRIVAL) {
      this.mode = 'present';
      this.beginPresenting(false);
      return true; // keep easing onto the exact spot
    }
    // The caption never waits on a long walk (architecture 6.4).
    if (!this.presentationSet && time - this.intentSince >= this.cfg.presentDelay) {
      this.state.presentation = this.presentationFor(this.intent);
      this.presentationSet = true;
    }
    return true;
  }

  private tickPresent(V: Vec2, reduced: boolean, cam: Vec2 | null): boolean {
    if (this.intent.kind === 'none') {
      this.mode = 'follow';
      return false;
    }
    this.beginPresenting(reduced);
    if (!this.spot) this.spot = this.computePresentSpot(this.intent, V, cam);
    // Stay put unless the Visitor has drifted away from the Guide.
    if (dist2(this.pos, V) > 3.2) {
      this.spot = this.computePresentSpot(this.intent, V, cam);
      this.spotVisitor = { ...V };
      this.mode = 'approach';
      return true;
    }
    // Settle onto the exact spot, then hold still.
    return this.spot !== null && dist2(this.pos, this.spot) > 0.1;
  }

  /** The spot beside the Visitor, never between her and the picture (FR-30). */
  private computePresentSpot(intent: PresentationIntent, V: Vec2, cam: Vec2 | null): Vec2 {
    const off = this.cfg.presentOffset;
    const candidates: Vec2[] = [];
    let tangent: Vec2;

    if (intent.kind === 'photo') {
      const slot: PhotoSlot | undefined = this.layout.slots[intent.slotIndex];
      if (slot) {
        tangent = { x: -slot.normal.z, z: slot.normal.x };
        // Stand on the side farther from the picture's centre so she keeps the view.
        let side = Math.sign(
          dot2({ x: V.x - slot.zonePoint.x, z: V.z - slot.zonePoint.z }, tangent),
        );
        if (side === 0)
          side = Math.sign(dot2({ x: this.pos.x - V.x, z: this.pos.z - V.z }, tangent)) || 1;
        for (const o of [off, off * 0.8]) {
          for (const sgn of [side, -side]) {
            // A touch back from the wall so the Guide is never nearer the picture than she is.
            candidates.push({
              x: V.x + tangent.x * sgn * o + slot.normal.x * 0.1,
              z: V.z + tangent.z * sgn * o + slot.normal.z * 0.1,
            });
          }
        }
        candidates.push({ x: V.x + slot.normal.x * 1.0, z: V.z + slot.normal.z * 1.0 });
      }
    } else {
      const toCentre = normalize2(
        { x: this.layout.finale.center.x - V.x, z: this.layout.finale.center.z - V.z },
        { x: 1, z: 0 },
      );
      tangent = { x: -toCentre.z, z: toCentre.x };
      const side = Math.sign(dot2({ x: this.pos.x - V.x, z: this.pos.z - V.z }, tangent)) || 1;
      for (const o of [off, off * 0.8]) {
        for (const sgn of [side, -side]) {
          candidates.push({ x: V.x + tangent.x * sgn * o, z: V.z + tangent.z * sgn * o });
        }
      }
    }

    let fallback: Vec2 | null = null;
    for (const c of candidates) {
      if (!this.nav.isWalkable(c) || !this.nav.hasSightLine(V, c, 0.1)) continue;
      fallback ??= c;
      if (cam && this.inCorridor(c, V, cam, 0.5)) continue;
      return c;
    }
    return fallback ?? this.nav.nearestWalkable({ x: V.x + off, z: V.z });
  }

  // ---- Relocate ----------------------------------------------------------------------------

  private startRelocate(
    after: 'follow' | 'approach',
    reduced: boolean,
    V: Vec2,
    cam: Vec2 | null,
  ): void {
    this.relocateAfter = after;
    this.stuckTimer = 0;
    this.path = [];
    this.pathGoal = null;
    this.followTarget = null;
    this.yieldTarget = null;
    if (reduced) {
      this.finishRelocate(V, cam, true);
      return;
    }
    this.mode = 'relocate';
    this.relocatePhase = 'out';
    this.fadeTarget = 0;
  }

  private tickRelocate(V: Vec2, cam: Vec2 | null, reduced: boolean): void {
    this.moveSpeed = 0;
    if (this.relocatePhase === 'out') {
      if (this.state.opacity <= 0.001 || reduced) this.finishRelocate(V, cam, reduced);
    } else if (this.state.opacity >= 0.999) {
      this.mode =
        this.relocateAfter === 'approach' && this.intent.kind !== 'none' ? 'approach' : 'follow';
      this.fadeTarget = 1;
    }
  }

  private finishRelocate(V: Vec2, cam: Vec2 | null, instant: boolean): void {
    const wantApproach = this.relocateAfter === 'approach' && this.intent.kind !== 'none';
    if (wantApproach && !this.spot) this.spot = this.computePresentSpot(this.intent, V, cam);
    const dest = wantApproach && this.spot ? this.spot : this.chooseRelocateSpot(V, cam);
    this.pos.x = dest.x;
    this.pos.z = dest.z;
    this.state.teleportSeq += 1;
    this.state.heading = headingOf(normalize2({ x: V.x - dest.x, z: V.z - dest.z }));
    this.moveSpeed = 0;
    this.walking = false;
    if (instant) {
      this.state.opacity = 1;
      this.fadeTarget = 1;
      this.mode = wantApproach ? 'approach' : 'follow';
    } else {
      this.relocatePhase = 'in';
      this.fadeTarget = 1;
    }
  }

  /** A spot 2 to 4 m from the Visitor, in line of sight, preferably off screen. Otherwise beside. */
  private chooseRelocateSpot(V: Vec2, cam: Vec2 | null): Vec2 {
    const view = this.getView();
    const camForward = cam ? normalize2({ x: V.x - cam.x, z: V.z - cam.z }) : null;
    let best: Vec2 | null = null;
    let bestScore = Infinity;
    for (const radius of [2.2, 3, 3.8]) {
      for (let k = 0; k < 16; k++) {
        const az = (k / 16) * Math.PI * 2;
        const cand: Vec2 = { x: V.x + Math.sin(az) * radius, z: V.z + Math.cos(az) * radius };
        if (!this.nav.isWalkable(cand) || !this.nav.hasSightLine(V, cand, 0.1)) continue;
        if (cam && this.inCorridor(cand, V, cam, 0.6)) continue;
        let score = Math.abs(radius - 2.6);
        if (view && cam && camForward && this.onScreen(cand, cam, camForward, view, 1)) score += 2;
        // Prefer the side the Guide was already on, to avoid a long diagonal pop.
        score += dist2(cand, this.pos) * 0.02;
        if (score < bestScore) {
          bestScore = score;
          best = cand;
        }
      }
    }
    return best ?? this.nav.nearestWalkable({ x: V.x + 1.2, z: V.z });
  }

  // ---- Yield -------------------------------------------------------------------------------

  /** Sidestep out of the Visitor's path and the camera corridor (FR-30). True while moving aside. */
  private tickYield(V: Vec2, cam: Vec2 | null): boolean {
    const G = this.pos;
    const V1: Vec2 = { x: V.x + this.visitorVelocity.x, z: V.z + this.visitorVelocity.z };
    const overlap = dist2(G, V) < OVERLAP_RADIUS || dist2(G, V1) < OVERLAP_RADIUS;
    const corridor = cam !== null && this.inCorridor(G, V, cam, CORRIDOR_HALF_WIDTH * 2);

    if (!overlap && !corridor) {
      this.yieldTarget = null;
      this.yieldBlocked = false;
      return false;
    }
    if (this.yieldTarget && dist2(G, this.yieldTarget) > 0.15) return true;

    // Sidestep at right angles to whichever line we are blocking.
    let axis: Vec2;
    if (corridor && cam) axis = normalize2({ x: V.x - cam.x, z: V.z - cam.z });
    else axis = normalize2(this.visitorVelocity, normalize2({ x: G.x - V.x, z: G.z - V.z }));
    const perp: Vec2 = { x: -axis.z, z: axis.x };
    const options: Vec2[] = [];
    for (const dist of [1.1, 0.8]) {
      for (const sgn of [1, -1]) {
        options.push({ x: G.x + perp.x * sgn * dist, z: G.z + perp.z * sgn * dist });
      }
    }
    // Prefer the side that ends farther from where the Visitor is heading.
    options.sort((a, b) => dist2(b, V1) - dist2(a, V1));
    for (const o of options) {
      if (!this.nav.isWalkable(o) || !this.nav.hasLineOfSight(G, o, 0.25)) continue;
      const stillBad =
        dist2(o, V) < OVERLAP_RADIUS ||
        dist2(o, V1) < OVERLAP_RADIUS ||
        (cam && this.inCorridor(o, V, cam, 0.5));
      if (stillBad) continue;
      this.yieldTarget = o;
      this.yieldBlocked = false;
      return true;
    }
    // Nowhere to go: fade to 35% until clear.
    this.yieldTarget = null;
    this.yieldBlocked = true;
    return false;
  }

  private inCorridor(p: Vec2, V: Vec2, cam: Vec2, width: number): boolean {
    const { dist, t } = distToSegment(p, cam, V);
    return dist < width / 2 && t < 0.97;
  }

  private inVisitorPath(p: Vec2, V: Vec2, fwd: Vec2): boolean {
    const end: Vec2 = { x: V.x + fwd.x * 3, z: V.z + fwd.z * 3 };
    return distToSegment(p, V, end).dist < 0.8;
  }

  private onScreen(
    p: Vec2,
    cam: Vec2,
    camForward: Vec2,
    view: GuideViewInfo,
    fraction: number,
  ): boolean {
    const hHalf = Math.atan(Math.tan(view.fovY / 2) * view.aspect);
    const to = normalize2({ x: p.x - cam.x, z: p.z - cam.z });
    const angle = Math.abs(angleDiff(headingOf(camForward), headingOf(to)));
    return angle < hHalf * fraction;
  }

  // ---- Movement ----------------------------------------------------------------------------

  private goal(V: Vec2): Vec2 | null {
    if (this.yieldTarget) return this.yieldTarget;
    if (this.mode === 'follow') return this.followTarget;
    if (this.mode === 'approach' || this.mode === 'present') return this.spot;
    void V;
    return null;
  }

  private integrateMovement(dt: number, wantsToMove: boolean, V: Vec2): void {
    const s = this.state;
    const goal = wantsToMove ? this.goal(V) : null;
    let moved = 0;
    let dir: Vec2 | null = null;

    if (goal) {
      this.replanTimer -= dt;
      const goalMoved = !this.pathGoal || dist2(goal, this.pathGoal) > 1;
      if (goalMoved || this.replanTimer <= 0 || this.path.length === 0) {
        this.path = this.nav.findPath(this.pos, goal) ?? [{ x: goal.x, z: goal.z }];
        this.pathGoal = { x: goal.x, z: goal.z };
        this.replanTimer = 0.5;
      }
      while (this.path.length > 0) {
        const wp = this.path[0] as Vec2;
        const last = this.path.length === 1;
        if (dist2(this.pos, wp) < (last ? 0.08 : WAYPOINT)) this.path.shift();
        else break;
      }
      const wp = this.path[0];
      if (wp) {
        const remaining = dist2(this.pos, goal);
        const catchUp = dist2(this.pos, V) > this.cfg.followFar + 0.8 || this.yieldTarget !== null;
        const cap = catchUp ? this.cfg.catchUpSpeed : this.cfg.walkSpeed;
        const target = Math.min(cap, Math.max(0.5, remaining * 1.8));
        // Gentle acceleration, quick braking.
        this.moveSpeed += clamp(target - this.moveSpeed, -12 * dt, 5 * dt);
        dir = normalize2({ x: wp.x - this.pos.x, z: wp.z - this.pos.z });
        const step = Math.min(this.moveSpeed * dt, dist2(this.pos, wp));
        const before = { x: this.pos.x, z: this.pos.z };
        moveCircle(this.pos, dir.x * step, dir.z * step, this.layout.colliders, this.layout.bounds);
        moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z) / dt;
      }
    } else {
      this.moveSpeed = 0;
      this.path = [];
      this.pathGoal = null;
    }

    // Stuck detection (FR-31): wants to move but stays within 0.6 m of one spot. Measuring net
    // displacement (not speed) also catches a Guide that slides back and forth in a pocket.
    if (goal && dist2(this.pos, goal) > 0.4) {
      if (dist2(this.pos, this.stuckAnchor) > 0.6) {
        this.stuckAnchor = { x: this.pos.x, z: this.pos.z };
        this.stuckTimer = 0;
      } else {
        this.stuckTimer += dt;
      }
    } else {
      this.stuckAnchor = { x: this.pos.x, z: this.pos.z };
      this.stuckTimer = 0;
    }

    this.walking = this.walking ? moved > 0.08 : moved > 0.15;
    s.position.x = this.pos.x;
    s.position.z = this.pos.z;
    s.speed = this.walking ? moved : 0;
    s.locomotion = this.walking ? 'walk' : 'idle';

    // Heading: face the way we walk; present facing half-way between picture and Visitor.
    let desired: number | null = null;
    let rate = 10;
    if (this.walking && dir) desired = headingOf(dir);
    else if (this.mode === 'present') {
      desired = this.presentHeading(V);
      rate = 5;
    } else if (this.mode !== 'relocate' && dist2(this.pos, V) > 0.5) {
      desired = headingOf({ x: V.x - this.pos.x, z: V.z - this.pos.z });
      rate = 3;
    }
    if (desired !== null) s.heading = turnTowards(s.heading, desired, rate * dt);
  }

  private presentHeading(V: Vec2): number {
    const toVisitor = normalize2({ x: V.x - this.pos.x, z: V.z - this.pos.z });
    if (this.intent.kind === 'photo') {
      const slot = this.layout.slots[this.intent.slotIndex];
      if (slot) {
        const toPhoto = normalize2({
          x: slot.position.x - this.pos.x,
          z: slot.position.z - this.pos.z,
        });
        return headingOf({ x: toVisitor.x + toPhoto.x, z: toVisitor.z + toPhoto.z });
      }
    }
    return headingOf(toVisitor);
  }

  private updateOpacity(dt: number, reduced: boolean): void {
    let target = this.fadeTarget;
    if (this.yieldBlocked && this.mode !== 'relocate')
      target = Math.min(target, this.cfg.yieldOpacity);
    const o = this.state.opacity;
    if (reduced && this.mode !== 'present') {
      this.state.opacity = target;
      return;
    }
    const rate = 1 / this.cfg.fadeSeconds;
    this.state.opacity =
      o < target ? Math.min(target, o + rate * dt) : Math.max(target, o - rate * dt);
  }

  private updateGesture(dt: number, reduced: boolean): void {
    if (this.gestureTimer > 0) {
      this.gestureTimer -= dt;
      if (this.gestureTimer <= 0 || reduced) this.state.gesture = 'none';
    }
  }

  private hardReset(): void {
    const s = this.state;
    s.position.x = this.pos.x;
    s.position.z = this.pos.z;
    s.speed = 0;
    s.locomotion = 'idle';
    s.gesture = 'none';
    s.presentation = { kind: 'none' };
    s.opacity = 1;
    s.teleportSeq += 1;
    this.mode = 'follow';
    this.key = 'none';
    this.intent = { kind: 'none' };
    this.presentationSet = false;
    this.spot = null;
    this.followTarget = null;
    this.path = [];
    this.pathGoal = null;
    this.yieldTarget = null;
    this.yieldBlocked = false;
    this.stuckTimer = 0;
    this.stuckAnchor = { x: this.pos.x, z: this.pos.z };
    this.moveSpeed = 0;
    this.walking = false;
    this.fadeTarget = 1;
    this.gestureTimer = 0;
  }
}
