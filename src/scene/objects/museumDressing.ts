import type { BufferGeometry } from 'three';
import type { MuseumLayout } from '@/domain/layout/types';
import { mergeParts, mergePlaced } from '../materials/geometry/builders';
import { createCeilingRoseGeometry, WALL } from '../materials/geometry/walls';
import { createFrameGeometry, createPictureLightGeometry } from '../materials/geometry/frames';
import { createWallWashGeometry } from '../materials/geometry/decals';
import { createLecternGeometry } from '../materials/geometry/finale';

/**
 * The technical-artist's dressing, placed from the layout and merged into as few draw calls as
 * possible: frames, picture lights, ceiling roses and the lectern share one vertex-coloured
 * material (one draw call); the soft wall washes share another.
 * A frame's local +Z faces the room and z = 0 is the wall surface, so a picture on the left wall
 * (normal +X) turns by +PI/2 and one on the right wall by -PI/2.
 */
export interface MuseumDressing {
  /** Frames, picture lights, ceiling roses and lectern, for the decor material. */
  decor: BufferGeometry;
  /** Soft warm wash around each frame, for the wall wash material. Null with no pictures. */
  wash: BufferGeometry | null;
  dispose(): void;
}

export function buildMuseumDressing(layout: MuseumLayout): MuseumDressing {
  const decorParts: BufferGeometry[] = [];

  for (const slot of layout.slots) {
    const place = [
      {
        position: [slot.position.x, slot.position.y, slot.position.z] as const,
        rotationY: slot.normal.x > 0 ? Math.PI / 2 : -Math.PI / 2,
      },
    ];
    decorParts.push(mergePlaced(createFrameGeometry(slot.width, slot.height), place));
    decorParts.push(mergePlaced(createPictureLightGeometry(slot.width, slot.height), place));
  }

  // One ceiling rose at the centre of every room; the finale gets a larger oculus above the podium.
  for (const room of layout.rooms) {
    const cx = (room.bounds.minX + room.bounds.maxX) / 2;
    const cz = (room.bounds.minZ + room.bounds.maxZ) / 2;
    const isFinale = room.kind === 'finale';
    decorParts.push(
      mergePlaced(createCeilingRoseGeometry({ radius: isFinale ? 0.9 : 0.4 }), [
        {
          position: isFinale
            ? [layout.finale.center.x, WALL.height, layout.finale.center.z]
            : [cx, WALL.height, cz],
        },
      ]),
    );
  }

  const lectern = layout.finale.lectern;
  decorParts.push(
    mergePlaced(createLecternGeometry(), [
      { position: [(lectern.minX + lectern.maxX) / 2, 0, (lectern.minZ + lectern.maxZ) / 2] },
    ]),
  );

  const washParts = layout.slots.map((slot) =>
    mergePlaced(createWallWashGeometry(slot.width, slot.height), [
      {
        position: [slot.position.x, slot.position.y, slot.position.z],
        rotationY: slot.normal.x > 0 ? Math.PI / 2 : -Math.PI / 2,
      },
    ]),
  );

  const decor = mergeParts(decorParts);
  const wash = washParts.length > 0 ? mergeParts(washParts) : null;
  return {
    decor,
    wash,
    dispose() {
      decor.dispose();
      wash?.dispose();
    },
  };
}
