import { angleDiff, lerp } from '../math/vec2';
import type {
  CharacterState,
  CharacterStateSource,
  Gesture,
  Locomotion,
  Presentation,
  Vec3,
  WorldContext,
} from './characterState';
import { createCharacterState } from './createCharacterState';

export interface ScriptKeyframe {
  /** Seconds from the start of the script. */
  t: number;
  position: Vec3;
  heading?: number;
  locomotion?: Locomotion;
  gesture?: Gesture;
  presentation?: Presentation;
  opacity?: number;
}

/**
 * A source driven by a script or by direct calls. It is the proof of NFR-25: a test (or later a
 * network peer) can drive either character through the same `CharacterStateSource` interface,
 * and the avatar, name label and caption panel follow without knowing the difference.
 */
export class ScriptedCharacterSource implements CharacterStateSource {
  readonly kind = 'scripted' as const;
  private readonly state: CharacterState;
  private frames: ScriptKeyframe[] = [];
  private elapsed = 0;
  private loop = false;
  private playing = false;

  constructor(initial: Partial<CharacterState> = {}) {
    this.state = createCharacterState(initial);
  }

  /** Overwrite any fields immediately. Position and presentation are copied, not shared. */
  set(patch: Partial<CharacterState>): void {
    const { position, presentation, ...rest } = patch;
    Object.assign(this.state, rest);
    if (position) Object.assign(this.state.position, position);
    if (presentation) this.state.presentation = presentation;
  }

  /** Play keyframes sorted by time. Position and heading interpolate; other fields step. */
  play(frames: readonly ScriptKeyframe[], options: { loop?: boolean } = {}): void {
    this.frames = [...frames].sort((a, b) => a.t - b.t);
    this.elapsed = 0;
    this.loop = options.loop ?? false;
    this.playing = this.frames.length > 0;
    if (this.playing) this.apply(0);
  }

  tick(dt: number, world: WorldContext): void {
    this.state.timestamp = world.time * 1000;
    if (!this.playing || this.frames.length === 0) return;
    const last = this.frames[this.frames.length - 1] as ScriptKeyframe;
    this.elapsed += dt;
    if (this.elapsed > last.t) {
      if (this.loop && last.t > 0) this.elapsed %= last.t;
      else {
        this.elapsed = last.t;
        this.playing = false;
      }
    }
    this.apply(dt);
  }

  read(): Readonly<CharacterState> {
    return this.state;
  }

  teleport(position: Vec3, heading: number): void {
    this.playing = false;
    this.state.position.x = position.x;
    this.state.position.y = position.y;
    this.state.position.z = position.z;
    this.state.heading = heading;
    this.state.speed = 0;
    this.state.teleportSeq += 1;
  }

  private apply(dt: number): void {
    const frames = this.frames;
    let i = 0;
    while (i < frames.length - 1 && (frames[i + 1] as ScriptKeyframe).t <= this.elapsed) i++;
    const a = frames[i] as ScriptKeyframe;
    const b = frames[Math.min(i + 1, frames.length - 1)] as ScriptKeyframe;
    const span = b.t - a.t;
    const f = span > 1e-9 ? Math.min(1, Math.max(0, (this.elapsed - a.t) / span)) : 1;
    const s = this.state;
    const px = lerp(a.position.x, b.position.x, f);
    const py = lerp(a.position.y, b.position.y, f);
    const pz = lerp(a.position.z, b.position.z, f);
    s.speed = dt > 0 ? Math.hypot(px - s.position.x, pz - s.position.z) / dt : 0;
    s.position.x = px;
    s.position.y = py;
    s.position.z = pz;
    if (a.heading !== undefined) {
      const target = b.heading ?? a.heading;
      s.heading = a.heading + angleDiff(a.heading, target) * f;
    }
    if (a.locomotion) s.locomotion = a.locomotion;
    if (a.gesture) s.gesture = a.gesture;
    if (a.presentation) s.presentation = a.presentation;
    if (a.opacity !== undefined) s.opacity = a.opacity;
  }
}
