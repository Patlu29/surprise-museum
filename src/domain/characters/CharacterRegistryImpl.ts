import type {
  CharacterRegistry,
  CharacterRole,
  CharacterState,
  CharacterStateSource,
  Presentation,
  WorldContext,
} from './characterState';
import { presentationEquals } from './createCharacterState';

type Listener = (role: CharacterRole, presentation: Presentation) => void;

interface MutableWorld {
  time: number;
  characters: Map<CharacterRole, Readonly<CharacterState>>;
  camera: WorldContext['camera'];
  reducedMotion: boolean;
}

const ORDER: readonly CharacterRole[] = ['visitor', 'guide'];

/**
 * Holds one source per role (ADR 0006). Swapping in a `NetworkCharacterSource` later is one
 * `setSource` call: renderers, labels and the caption panel only ever see `CharacterState`.
 * Per-frame data stays inside the sources; only presentation changes leave through the listener.
 */
export class CharacterRegistryImpl implements CharacterRegistry {
  private readonly sources = new Map<CharacterRole, CharacterStateSource>();
  private readonly listeners = new Set<Listener>();
  private readonly lastPresentation = new Map<CharacterRole, Presentation>();
  private readonly world: MutableWorld = {
    time: 0,
    characters: new Map(),
    camera: { position: { x: 0, y: 2.2, z: 4 }, forward: { x: 0, y: 0, z: -1 } },
    reducedMotion: false,
  };

  setSource(role: CharacterRole, source: CharacterStateSource): void {
    const previous = this.sources.get(role);
    if (previous && previous !== source) previous.dispose?.();
    this.sources.set(role, source);
    this.world.characters.set(role, source.read());
    // A new source starts from "nothing presented", so a source that begins mid-presentation
    // (a network peer) is reported on the next tick.
    this.lastPresentation.set(role, { kind: 'none' });
  }

  getSource(role: CharacterRole): CharacterStateSource {
    const source = this.sources.get(role);
    if (!source) throw new Error(`No character source registered for "${role}".`);
    return source;
  }

  hasSource(role: CharacterRole): boolean {
    return this.sources.has(role);
  }

  tickAll(dt: number, world: Omit<WorldContext, 'characters'>): void {
    this.world.time = world.time;
    this.world.camera = world.camera;
    this.world.reducedMotion = world.reducedMotion;

    for (const role of ORDER) {
      const source = this.sources.get(role);
      if (!source) continue;
      source.tick(dt, this.world as WorldContext);
      this.world.characters.set(role, source.read());
    }

    for (const role of ORDER) {
      const source = this.sources.get(role);
      if (!source) continue;
      const now = source.read().presentation;
      const before = this.lastPresentation.get(role) ?? { kind: 'none' };
      if (!presentationEquals(before, now)) {
        const snapshot: Presentation = { ...now };
        this.lastPresentation.set(role, snapshot);
        for (const listener of this.listeners) listener(role, snapshot);
      }
    }
  }

  onPresentationChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Dispose every source. Called when the scene unmounts. */
  dispose(): void {
    for (const source of this.sources.values()) source.dispose?.();
    this.sources.clear();
    this.listeners.clear();
  }
}
