import { Color, type BufferGeometry } from 'three';
import { LAYOUT } from '@/domain/layout/constants';
import type { MuseumLayout } from '@/domain/layout/types';
import {
  boxPart,
  mergeParts,
  mergePlaced,
  normaliseAttributes,
} from '../materials/geometry/builders';
import {
  createFrameContactShadowGeometry,
  createPlinthContactShadowGeometry,
  createWallWashGeometry,
} from '../materials/geometry/decals';
import { PODIUM, createLecternGeometry } from '../materials/geometry/finale';
import { createFrameGeometry, createPictureLightGeometry } from '../materials/geometry/frames';
import {
  WALL,
  createCeilingRoseGeometry,
  createCeilingStripGeometry,
  createWallCapGeometry,
} from '../materials/geometry/walls';
import { LOOK } from '../materials/look';
import { DADO } from '../materials/worldMapping';

/**
 * The technical-artist's dressing, placed from the layout and merged into as few draw calls as
 * possible:
 *  - `decor` (one draw call): frames, picture lights, the lectern, the 0.06 m wall caps on the
 *    outer wall tops (the cutaway's finished edge, spec 6.3) and the real dado rail (0.05 by
 *    0.04 m at y 0.95, spec 12.8.3) along the outer walls. The internal walls fade, so they get
 *    neither (the wall shader already paints the rail band and the cap colour on them).
 *  - `ceilingDressing` (one draw call): a rose in every room, the finale oculus and one recessed
 *    strip per route room, fading with the ceiling (`setCeilingDressingOpacity`).
 *  - `contactShadow` (one draw call, none on Low): a soft shadow behind every frame and under the
 *    podium.
 *  - `wash`: soft warm wash around each frame.
 * A frame's local +Z faces the room and z = 0 is the wall surface, so a picture on the left wall
 * (normal +X) turns by +PI/2 and one on the right wall by -PI/2.
 */
export interface MuseumDressing {
  /** Frames, picture lights, lectern, wall caps and dado rail, for the decor material. */
  decor: BufferGeometry;
  /** Roses, oculus and ceiling strips, for `ceilingDressing`. */
  ceilingDressing: BufferGeometry;
  /** Frame and podium contact shadows for `contactShadow`; null when the tier has none. */
  contactShadow: BufferGeometry | null;
  /** Soft warm wash around each frame, for the wall wash material. Null with no pictures. */
  wash: BufferGeometry | null;
  dispose(): void;
}

const QUARTER_TURN = Math.PI / 2;
/** The finale room's rail is dimmed to 62%, as in the wall shader. */
const FINALE_RAIL = '#' + new Color(LOOK.dadoRail).multiplyScalar(0.62).getHexString();

/** The wall caps on the outer wall tops: both side walls of every room, the back and the end. */
function wallCaps(layout: MuseumLayout): BufferGeometry[] {
  const t = LAYOUT.wallThickness;
  const ht = t / 2;
  const half = LAYOUT.halfWidth;
  const H = LAYOUT.wallHeight;
  const parts: BufferGeometry[] = [];
  for (const room of layout.rooms) {
    const z0 = room.bounds.minZ - ht;
    const z1 = room.bounds.maxZ + ht;
    const cap = createWallCapGeometry(z1 - z0, t);
    parts.push(
      mergePlaced(cap, [
        { position: [-(half + ht), H, (z0 + z1) / 2], rotationY: QUARTER_TURN },
        { position: [half + ht, H, (z0 + z1) / 2], rotationY: QUARTER_TURN },
      ]),
    );
    cap.dispose();
  }
  const across = createWallCapGeometry(2 * (half + t), t);
  const backZ = 0;
  const endZ = layout.bounds.minZ - ht;
  parts.push(mergePlaced(across, [{ position: [0, H, backZ] }, { position: [0, H, endZ] }]));
  across.dispose();
  return parts;
}

/** The dado rail along the inner faces of the outer walls, `DADO.railHeight` thick at y 0.95. */
function dadoRails(layout: MuseumLayout): BufferGeometry[] {
  const half = LAYOUT.halfWidth;
  const y = DADO.height + DADO.railHeight / 2;
  const d = DADO.railDepth;
  const parts: BufferGeometry[] = [];
  for (const room of layout.rooms) {
    const colour = room.kind === 'finale' ? FINALE_RAIL : LOOK.dadoRail;
    const len = room.bounds.maxZ - room.bounds.minZ;
    const z = (room.bounds.minZ + room.bounds.maxZ) / 2;
    for (const side of [-1, 1]) {
      parts.push(
        normaliseAttributes(
          boxPart(d, DADO.railHeight, len, { x: side * (half - d / 2), y, z, colour }),
        ),
      );
    }
  }
  const first = layout.rooms[0];
  const last = layout.rooms[layout.rooms.length - 1];
  if (first) {
    parts.push(
      normaliseAttributes(
        boxPart(2 * half, DADO.railHeight, d, {
          y,
          z: first.bounds.maxZ - d / 2,
          colour: LOOK.dadoRail,
        }),
      ),
    );
  }
  if (last) {
    parts.push(
      normaliseAttributes(
        boxPart(2 * half, DADO.railHeight, d, {
          y,
          z: last.bounds.minZ + d / 2,
          colour: last.kind === 'finale' ? FINALE_RAIL : LOOK.dadoRail,
        }),
      ),
    );
  }
  return parts;
}

export function buildMuseumDressing(
  layout: MuseumLayout,
  options: { contactShadows: boolean } = { contactShadows: true },
): MuseumDressing {
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

  const lectern = layout.finale.lectern;
  decorParts.push(
    mergePlaced(createLecternGeometry(), [
      { position: [(lectern.minX + lectern.maxX) / 2, 0, (lectern.minZ + lectern.maxZ) / 2] },
    ]),
  );

  decorParts.push(...wallCaps(layout), ...dadoRails(layout));

  // Ceiling dressing: a rose at every room's centre, a larger oculus ring over the podium, and
  // one recessed strip per route room (not the finale) on the centre line, nearer the entrance.
  const ceilingParts: BufferGeometry[] = [];
  const rose = createCeilingRoseGeometry({ radius: 0.4 });
  const oculus = createCeilingRoseGeometry({ radius: 0.9 });
  for (const room of layout.rooms) {
    const cx = (room.bounds.minX + room.bounds.maxX) / 2;
    const cz = (room.bounds.minZ + room.bounds.maxZ) / 2;
    if (room.kind === 'finale') {
      ceilingParts.push(
        mergePlaced(oculus, [
          { position: [layout.finale.center.x, WALL.height, layout.finale.center.z] },
        ]),
      );
      continue;
    }
    ceilingParts.push(mergePlaced(rose, [{ position: [cx, WALL.height, cz] }]));
    const depth = room.bounds.maxZ - room.bounds.minZ;
    const strip = createCeilingStripGeometry();
    ceilingParts.push(
      mergePlaced(strip, [{ position: [cx, WALL.height, cz + Math.min(depth * 0.3, 2.4)] }]),
    );
    strip.dispose();
  }
  rose.dispose();
  oculus.dispose();

  // Contact shadows: behind every frame, and under the podium. Not on Low.
  let contactShadow: BufferGeometry | null = null;
  if (options.contactShadows) {
    const shadowParts = layout.slots.map((slot) =>
      mergePlaced(createFrameContactShadowGeometry(slot.width, slot.height), [
        {
          position: [slot.position.x, slot.position.y, slot.position.z],
          rotationY: slot.normal.x > 0 ? Math.PI / 2 : -Math.PI / 2,
        },
      ]),
    );
    shadowParts.push(
      mergePlaced(createPlinthContactShadowGeometry(PODIUM.radius), [
        { position: [layout.finale.center.x, 0, layout.finale.center.z] },
      ]),
    );
    contactShadow = mergeParts(shadowParts);
  }

  const washParts = layout.slots.map((slot) =>
    mergePlaced(createWallWashGeometry(slot.width, slot.height), [
      {
        position: [slot.position.x, slot.position.y, slot.position.z],
        rotationY: slot.normal.x > 0 ? Math.PI / 2 : -Math.PI / 2,
      },
    ]),
  );

  const decor = mergeParts(decorParts);
  const ceilingDressing = mergeParts(ceilingParts);
  const wash = washParts.length > 0 ? mergeParts(washParts) : null;
  return {
    decor,
    ceilingDressing,
    contactShadow,
    wash,
    dispose() {
      decor.dispose();
      ceilingDressing.dispose();
      contactShadow?.dispose();
      wash?.dispose();
    },
  };
}
