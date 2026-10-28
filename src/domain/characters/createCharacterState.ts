import type { CharacterState, Presentation, Vec3 } from './characterState';

export function createCharacterState(patch: Partial<CharacterState> = {}): CharacterState {
  return {
    position: { x: 0, y: 0, z: 0 },
    heading: 0,
    speed: 0,
    locomotion: 'idle',
    gesture: 'none',
    presentation: { kind: 'none' },
    opacity: 1,
    teleportSeq: 0,
    timestamp: 0,
    ...patch,
  };
}

export function presentationEquals(a: Presentation, b: Presentation): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'photo' && b.kind === 'photo') return a.photoId === b.photoId;
  return true;
}

export function setVec3(target: Vec3, x: number, z: number, y = 0): void {
  target.x = x;
  target.y = y;
  target.z = z;
}
