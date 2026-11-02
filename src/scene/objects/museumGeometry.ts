import {
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  PlaneGeometry,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LAYOUT } from '@/domain/layout/constants';
import type { MuseumLayout } from '@/domain/layout/types';
import { SCENE_PALETTE } from '../materials/palette';

/**
 * Merged static geometry for the museum shell, built from the layout: a handful of draw calls
 * instead of one per wall. Plain boxes; the look (linen, oak, runner, shading) is applied by the
 * shell materials in the shader. Visual only: collision uses layout.colliders.
 *
 * The ceilings are single down-facing quads (no thickness), so they are culled from above.
 *
 * Internal walls (partitions) are kept as separate meshes, one each, so the one that blocks the
 * camera can fade without touching the others (design spec 6.3, integration round 1).
 */
export interface MuseumShell {
  /** Back wall and side walls of the entrance and galleries. */
  walls: BufferGeometry;
  /** Side walls and the closed end of the finale room. */
  wallsFinale: BufferGeometry;
  /** One per internal wall: two segments plus the lintel over the doorway. */
  partitions: Array<{ z: number; toFinale: boolean; geometry: BufferGeometry }>;
  floors: BufferGeometry;
  floorsFinale: BufferGeometry;
  ceilings: BufferGeometry;
  runner: BufferGeometry;
  dispose(): void;
}

function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): BoxGeometry {
  const g = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

/**
 * A flat ceiling for one room: one quad at y = `y` whose normal points down. With a front-side
 * material it is culled from above, so a camera above the roof sees straight into the rooms (the
 * cutaway, design spec 6.3) and the ceiling can never occlude from there.
 */
function ceilingQuad(x0: number, x1: number, y: number, z0: number, z1: number): PlaneGeometry {
  const g = new PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(Math.PI / 2); // +Z becomes -Y: faces down
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  // The ceiling colour comes from the palette (`--scene-ceiling`), as a vertex colour (the shell's
  // ceiling material is vertex-coloured). `Color` holds linear values, which is what three.js
  // expects in a colour attribute.
  const c = new Color(SCENE_PALETTE.ceiling);
  const colours: number[] = [];
  for (let i = 0; i < g.getAttribute('position').count; i++) colours.push(c.r, c.g, c.b);
  g.setAttribute('color', new Float32BufferAttribute(colours, 3));
  return g;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged;
}

export function buildMuseumShell(layout: MuseumLayout): MuseumShell {
  const half = LAYOUT.halfWidth;
  const t = LAYOUT.wallThickness;
  const ht = t / 2;
  const outer = half + t;
  const doorHalf = LAYOUT.doorWidth / 2;
  const H = LAYOUT.wallHeight;
  const end = layout.bounds.minZ - ht;

  const walls: BoxGeometry[] = [];
  const wallsFinale: BoxGeometry[] = [];
  const floors: BoxGeometry[] = [];
  const floorsFinale: BoxGeometry[] = [];
  const ceilings: PlaneGeometry[] = [];

  // Side walls, floors and ceilings per room.
  for (const room of layout.rooms) {
    const finale = room.kind === 'finale';
    const wallSet = finale ? wallsFinale : walls;
    const z0 = room.bounds.minZ - ht;
    const z1 = room.bounds.maxZ + ht;
    wallSet.push(box(-outer, -half, 0, H, z0, z1));
    wallSet.push(box(half, outer, 0, H, z0, z1));
    (finale ? floorsFinale : floors).push(box(-outer, outer, -0.1, 0, z0, z1));
    ceilings.push(ceilingQuad(-half, half, H, room.bounds.minZ, room.bounds.maxZ));
  }

  // Back wall behind the spawn, and the closed end of the museum (FR-34).
  walls.push(box(-outer, outer, 0, H, -ht, ht));
  wallsFinale.push(box(-outer, outer, 0, H, end - ht, end + ht));

  // Internal walls with doorways and a lintel over each.
  const partitions = layout.doorways.map((door) => ({
    z: door.z,
    toFinale: layout.rooms[door.toRoomIndex]?.kind === 'finale',
    geometry: merge([
      box(-outer, -doorHalf, 0, H, door.z - ht, door.z + ht),
      box(doorHalf, outer, 0, H, door.z - ht, door.z + ht),
      box(-doorHalf, doorHalf, LAYOUT.doorHeight, H, door.z - ht, door.z + ht),
    ]),
  }));

  // Claret runner down the centre line to the podium (design spec 1.4).
  const runner = box(-0.8, 0.8, 0.002, 0.012, layout.finale.center.z, -0.6);

  const shell: MuseumShell = {
    walls: merge(walls),
    wallsFinale: merge(wallsFinale),
    partitions,
    floors: merge(floors),
    floorsFinale: merge(floorsFinale),
    ceilings: merge(ceilings),
    runner: merge([runner]),
    dispose() {
      shell.walls.dispose();
      shell.wallsFinale.dispose();
      for (const p of shell.partitions) p.geometry.dispose();
      shell.floors.dispose();
      shell.floorsFinale.dispose();
      shell.ceilings.dispose();
      shell.runner.dispose();
    },
  };
  return shell;
}
