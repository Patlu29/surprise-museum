import type { Aabb } from '../navigation/geometry';
import { CHARACTER_RADIUS } from '../navigation/geometry';
import { moveCircle } from '../navigation/collision';
import { clamp, forwardOf, smoothingFactor, turnTowards, type Vec2 } from '../math/vec2';
import type {
  CharacterState,
  CharacterStateSource,
  MoveIntent,
  Vec3,
  WorldContext,
} from './characterState';
import { createCharacterState } from './createCharacterState';

export interface LocalVisitorOptions {
  /** Where the Visitor starts and which walls stop her. */
  layout: {
    colliders: readonly Aabb[];
    bounds: Aabb;
    spawn: { visitor: { position: Vec2; heading: number } };
  };
  /**
   * Camera-relative intent from joystick, keyboard or arrow buttons. Called once per tick; return
   * {0, 0} while input is disabled (welcome screen, full-screen viewer).
   */
  readIntent: () => MoveIntent;
  /** Walking speed at full deflection, m/s. Design spec 6.1. */
  maxSpeed?: number;
  /** Time constant (s) of the acceleration ease. Stopping is instant. Design spec 6.1. */
  accelerationTau?: number;
  radius?: number;
}

export const VISITOR_MAX_SPEED = 1.6;

/**
 * The Visitor's character: input in, collision-resolved state out (ADR 0006, ADR 0007).
 * Movement is camera-relative and uses 2D circle-versus-box collision, so she slides along walls
 * and cannot leave the museum (FR-34). It reads the camera from the world context, so it works
 * with any camera and never needs three.js.
 */
export class LocalVisitorController implements CharacterStateSource {
  readonly kind = 'local-input' as const;
  private readonly state: CharacterState;
  private readonly pos: Vec2;
  private readonly vel: Vec2 = { x: 0, z: 0 };
  private readonly maxSpeed: number;
  private readonly tau: number;
  private readonly radius: number;
  private lastCameraForward: Vec2 = { x: 0, z: -1 };
  private walking = false;

  private readonly opts: LocalVisitorOptions;

  constructor(opts: LocalVisitorOptions) {
    this.opts = opts;
    this.maxSpeed = opts.maxSpeed ?? VISITOR_MAX_SPEED;
    this.tau = opts.accelerationTau ?? 0.15;
    this.radius = opts.radius ?? CHARACTER_RADIUS;
    const spawn = opts.layout.spawn.visitor;
    this.pos = { x: spawn.position.x, z: spawn.position.z };
    this.state = createCharacterState({
      position: { x: spawn.position.x, y: 0, z: spawn.position.z },
      heading: spawn.heading,
    });
  }

  tick(dt: number, world: WorldContext): void {
    dt = Math.min(Math.max(dt, 0), 0.1);
    const intent = this.opts.readIntent();

    // Camera-relative basis on the floor plane.
    const cf = world.camera.forward;
    const cl = Math.hypot(cf.x, cf.z);
    if (cl > 0.05) this.lastCameraForward = { x: cf.x / cl, z: cf.z / cl };
    const fwd = this.lastCameraForward;
    const right: Vec2 = { x: -fwd.z, z: fwd.x };

    let ix = clamp(intent.x, -1, 1);
    let iy = clamp(intent.y, -1, 1);
    const mag = Math.hypot(ix, iy);
    if (mag > 1) {
      ix /= mag;
      iy /= mag;
    }
    const targetX = (right.x * ix + fwd.x * iy) * this.maxSpeed;
    const targetZ = (right.z * ix + fwd.z * iy) * this.maxSpeed;
    const targetSpeed = Math.hypot(targetX, targetZ);
    const currentSpeed = Math.hypot(this.vel.x, this.vel.z);

    if (targetSpeed < 1e-4) {
      this.vel.x = 0; // she stops at once (design spec 6.1)
      this.vel.z = 0;
    } else if (targetSpeed < currentSpeed) {
      this.vel.x = targetX;
      this.vel.z = targetZ;
    } else {
      const k = this.tau > 0 ? smoothingFactor(dt, this.tau) : 1;
      this.vel.x += (targetX - this.vel.x) * k;
      this.vel.z += (targetZ - this.vel.z) * k;
    }

    const before = { x: this.pos.x, z: this.pos.z };
    if (dt > 0) {
      moveCircle(
        this.pos,
        this.vel.x * dt,
        this.vel.z * dt,
        this.opts.layout.colliders,
        this.opts.layout.bounds,
        this.radius,
      );
    }
    const moved = dt > 0 ? Math.hypot(this.pos.x - before.x, this.pos.z - before.z) / dt : 0;

    // Walk cycle runs only while moving (FR-18); hysteresis stops it flickering at a wall.
    this.walking = this.walking ? moved > 0.08 : moved > 0.15;

    const s = this.state;
    if (targetSpeed > 0.05 && this.walking) {
      const desired = Math.atan2(targetX, targetZ);
      s.heading = turnTowards(s.heading, desired, 14 * dt);
    }
    s.position.x = this.pos.x;
    s.position.z = this.pos.z;
    s.speed = this.walking ? moved : 0;
    s.locomotion = this.walking ? 'walk' : 'idle';
    s.timestamp = world.time * 1000;
  }

  read(): Readonly<CharacterState> {
    return this.state;
  }

  teleport(position: Vec3, heading: number): void {
    this.pos.x = position.x;
    this.pos.z = position.z;
    this.vel.x = 0;
    this.vel.z = 0;
    this.walking = false;
    const s = this.state;
    s.position.x = position.x;
    s.position.y = position.y;
    s.position.z = position.z;
    s.heading = heading;
    s.speed = 0;
    s.locomotion = 'idle';
    s.teleportSeq += 1;
  }

  /** Unit forward vector of the character, for the Guide's path prediction. */
  forward(): Vec2 {
    return forwardOf(this.state.heading);
  }
}
