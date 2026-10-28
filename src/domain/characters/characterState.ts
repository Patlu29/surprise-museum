/**
 * Character-state abstraction (NFR-25, ADR 0006).
 *
 * Everything that renders a character (avatar, animation, name label, caption panel) reads a
 * CharacterState. Nothing that renders a character knows where that state comes from.
 * State comes from a CharacterStateSource:
 *
 *   MVP                                   Future live mode (FR-66)
 *   ----------------------------------    ---------------------------------------------
 *   visitor <- LocalVisitorController      visitor <- LocalVisitorController (+ publisher)
 *   guide   <- AutonomousGuideSource       guide   <- NetworkCharacterSource (Creator's input)
 *   tests   <- ScriptedCharacterSource
 *
 * Swapping a source must not require a change to any file under src/scene/characters,
 * src/ui or src/state. The scripted-source test required by NFR-25 proves this.
 *
 * Interfaces defined by the architect. Implementations: scene-developer.
 * This file must stay free of React, three.js and stores (lint-enforced), so that the same
 * logic can later run in a worker, a test or a server.
 */

/** Floor-plane metres. +X right, +Y up, the route runs from the entrance at z = 0 towards -Z. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type CharacterRole = 'visitor' | 'guide';

export type Locomotion = 'idle' | 'walk';

/** One-shot upper-body gesture layered over locomotion. 'present' is FR-19 (Should). */
export type Gesture = 'none' | 'present';

/** What a character is presenting. Only the Guide presents in the MVP. */
export type Presentation =
  | { kind: 'none' }
  | { kind: 'photo'; photoId: string }
  | { kind: 'finale' }
  /** Opening greeting, FR-9 (Should). */
  | { kind: 'greeting' };

export interface CharacterState {
  /** Feet position in world metres. */
  position: Vec3;
  /** Yaw in radians about +Y. 0 faces +Z; positive turns counter-clockwise seen from above. */
  heading: number;
  /** Horizontal speed in metres per second, used to blend and time the walk cycle. */
  speed: number;
  locomotion: Locomotion;
  gesture: Gesture;
  presentation: Presentation;
  /** 0 to 1. Used for the reduced-motion fade and the Guide's relocate fade (FR-31, FR-62). */
  opacity: number;
  /**
   * Increments whenever the position jumps (replay, relocate, teleport to a picture).
   * Renderers snap instead of interpolating when this changes.
   */
  teleportSeq: number;
  /** Source clock in milliseconds. Network sources use it for interpolation buffers. */
  timestamp: number;
}

/** Read-only view of the world handed to each source on every tick. */
export interface WorldContext {
  /** Seconds since the session started. */
  readonly time: number;
  /** Latest state of every character, including the one being ticked. */
  readonly characters: ReadonlyMap<CharacterRole, Readonly<CharacterState>>;
  /** Third-person camera pose, so the Guide can avoid hiding the Visitor (FR-30, FR-31). */
  readonly camera: { readonly position: Vec3; readonly forward: Vec3 };
  /** True when the OS requests reduced motion (FR-62). */
  readonly reducedMotion: boolean;
}

/**
 * A producer of character state. Sources receive their collaborators (layout, input, navigation,
 * presentation director) through their constructor, not through this interface, so the
 * interface stays the same for local, autonomous, scripted and network sources.
 */
export interface CharacterStateSource {
  readonly kind: 'local-input' | 'autonomous' | 'scripted' | 'network';
  /** Advance by dt seconds. Called once per frame, visitor first, then guide. */
  tick(dt: number, world: WorldContext): void;
  /** Latest state. Callers must treat it as read-only and must not keep it across frames. */
  read(): Readonly<CharacterState>;
  /** Move instantly, for replay and relocation. Network sources may ignore it. */
  teleport?(position: Vec3, heading: number): void;
  dispose?(): void;
}

/**
 * Holds the active source for each role and ticks them in a fixed order.
 * One instance per Visitor session, created by the scene and exposed to renderers through
 * a React context. The UI never reads it directly; it reads sessionStore, which the
 * registry's presentation-change callback updates.
 */
export interface CharacterRegistry {
  setSource(role: CharacterRole, source: CharacterStateSource): void;
  getSource(role: CharacterRole): CharacterStateSource;
  /** Ticks 'visitor' then 'guide', then reports presentation changes once per change. */
  tickAll(dt: number, world: Omit<WorldContext, 'characters'>): void;
  onPresentationChange(
    listener: (role: CharacterRole, presentation: Presentation) => void,
  ): () => void;
}

/** Camera-relative movement intent from joystick, keyboard or (later) a network peer. */
export interface MoveIntent {
  /** -1 (left) to 1 (right), relative to the camera. */
  x: number;
  /** -1 (back) to 1 (forward), relative to the camera. */
  y: number;
}
