import type { Vec2 } from '../math/vec2';
import { CHARACTER_RADIUS, circleIsFree, segmentClear, type Aabb } from '../navigation/geometry';
import { LAYOUT } from './constants';
import type {
  Doorway,
  FinaleZone,
  MuseumLayout,
  NavGraphData,
  NavNode,
  NavNodeKind,
  Partition,
  PhotoInput,
  PhotoSlot,
  Room,
} from './types';

const MAX_EDGE_LENGTH = 12;

/** Fit a photo inside the 1.6 by 1.4 m display box, keeping its aspect ratio (FR-39). */
export function fitPhoto(width: number, height: number): { width: number; height: number } {
  const aspect = width > 0 && height > 0 ? width / height : 4 / 3;
  const boxAspect = LAYOUT.photoBoxWidth / LAYOUT.photoBoxHeight;
  if (aspect >= boxAspect) {
    return { width: LAYOUT.photoBoxWidth, height: LAYOUT.photoBoxWidth / aspect };
  }
  return { width: LAYOUT.photoBoxHeight * aspect, height: LAYOUT.photoBoxHeight };
}

function box(minX: number, maxX: number, minZ: number, maxZ: number): Aabb {
  return { minX, maxX, minZ, maxZ };
}

/**
 * Generate the museum for 0 to 20 photos. Pure and deterministic (ADR 0009): the same photos
 * always give the same layout, so preview and published museums are identical.
 *
 * Plan (route towards -Z): entrance hall, ceil(n / 4) galleries, finale room.
 */
export function generateLayout(photos: readonly PhotoInput[]): MuseumLayout {
  if (photos.length > LAYOUT.maxPhotos) {
    throw new RangeError(
      `A museum holds at most ${LAYOUT.maxPhotos} photos, got ${photos.length}.`,
    );
  }

  const half = LAYOUT.halfWidth;
  const t = LAYOUT.wallThickness;
  const ht = t / 2;
  const rooms: Room[] = [];
  const slots: PhotoSlot[] = [];
  const doorways: Doorway[] = [];

  // ---- Rooms -------------------------------------------------------------------------------
  let cursor = 0;
  const pushRoom = (
    id: string,
    kind: Room['kind'],
    galleryIndex: number,
    depth: number,
    photoIds: string[],
  ): Room => {
    const room: Room = {
      id,
      kind,
      galleryIndex,
      bounds: box(-half, half, cursor - depth, cursor),
      photoIds,
    };
    rooms.push(room);
    cursor -= depth;
    return room;
  };

  pushRoom('entrance', 'entrance', 0, LAYOUT.entranceDepth, []);

  const galleryCount = Math.ceil(photos.length / LAYOUT.photosPerRoom);
  for (let g = 0; g < galleryCount; g++) {
    const chunk = photos.slice(g * LAYOUT.photosPerRoom, (g + 1) * LAYOUT.photosPerRoom);
    const deep = chunk.length >= 3;
    const depth = deep ? LAYOUT.galleryDepthFull : LAYOUT.galleryDepthSmall;
    const top = cursor;
    const roomIndex = rooms.length;
    pushRoom(
      `gallery-${g + 1}`,
      'gallery',
      g + 1,
      depth,
      chunk.map((p) => p.id),
    );

    chunk.forEach((photo, j) => {
      const wall = j % 2 === 0 ? 'left' : 'right';
      const row = Math.floor(j / 2);
      const offset = deep
        ? row === 0
          ? LAYOUT.nearOffsetFull
          : LAYOUT.farOffsetFull
        : LAYOUT.nearOffsetSmall;
      const z = top - offset;
      const wallX = wall === 'left' ? -half : half;
      const nx = wall === 'left' ? 1 : -1;
      const fitted = fitPhoto(photo.width, photo.height);
      slots.push({
        photoId: photo.id,
        index: g * LAYOUT.photosPerRoom + j,
        roomIndex,
        wall,
        position: { x: wallX, y: LAYOUT.photoCentreY, z },
        normal: { x: nx, z: 0 },
        width: fitted.width,
        height: fitted.height,
        frameWidth: fitted.width + LAYOUT.frameBorder * 2,
        frameHeight: fitted.height + LAYOUT.frameBorder * 2,
        zonePoint: { x: wallX + nx * LAYOUT.zoneOffset, z },
        standingSpot: { x: wallX + nx * LAYOUT.standingDistance, z },
      });
    });
  }

  const finaleTop = cursor;
  const finaleRoomIndex = rooms.length;
  pushRoom('finale', 'finale', 0, LAYOUT.finaleDepth, []);
  const end = cursor;

  // Doorways cut every internal wall (not the back wall and not the end wall).
  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i];
    if (!room) continue;
    doorways.push({
      z: room.bounds.maxZ,
      centerX: 0,
      width: LAYOUT.doorWidth,
      height: LAYOUT.doorHeight,
      toRoomIndex: i,
    });
  }

  // ---- Colliders ---------------------------------------------------------------------------
  const outer = half + t;
  const doorHalf = LAYOUT.doorWidth / 2;
  const colliders: Aabb[] = [
    box(-outer, outer, -ht, ht), // back wall behind the spawn point
    box(-outer, outer, end - ht, end + ht), // far end wall
    box(-outer, -half, end - ht, ht), // left side wall
    box(half, outer, end - ht, ht), // right side wall
  ];
  const partitions: Partition[] = [];
  for (const door of doorways) {
    const left = box(-outer, -doorHalf, door.z - ht, door.z + ht);
    const right = box(doorHalf, outer, door.z - ht, door.z + ht);
    colliders.push(left, right);
    partitions.push({ z: door.z, toRoomIndex: door.toRoomIndex, colliders: [left, right] });
  }
  const hard = colliders.filter((c) => !partitions.some((p) => p.colliders.includes(c)));

  // ---- Finale ------------------------------------------------------------------------------
  const finaleCentreZ = finaleTop - LAYOUT.finaleDepth / 2;
  const lectern = box(
    -LAYOUT.lecternWidth / 2,
    LAYOUT.lecternWidth / 2,
    end + ht + 0.05,
    end + ht + 0.05 + LAYOUT.lecternDepth,
  );
  colliders.push(lectern);
  hard.push(lectern);
  const finale: FinaleZone = {
    roomIndex: finaleRoomIndex,
    center: { x: 0, z: finaleCentreZ - LAYOUT.podiumOffset },
    radius: LAYOUT.podiumRadius,
    triggerRadius: LAYOUT.finaleTriggerRadius,
    exitRadius: LAYOUT.finaleTriggerRadius + 1,
    lectern,
  };

  const bounds = box(-half, half, end + ht, -ht);

  const spawn = {
    visitor: { position: { ...LAYOUT.spawnVisitor }, heading: LAYOUT.spawnHeading },
    guide: { position: { ...LAYOUT.spawnGuide }, heading: LAYOUT.spawnHeading },
  };

  const navGraph = buildNavGraph({ rooms, colliders, slots, doorways, finale, spawn, end, bounds });

  return {
    rooms,
    colliders,
    slots,
    doorways,
    partitions,
    hardColliders: hard,
    finale,
    spawn,
    navGraph,
    bounds,
    wallHeight: LAYOUT.wallHeight,
    wallThickness: LAYOUT.wallThickness,
  };
}

// ---- Navigation graph (ADR 0007) ------------------------------------------------------------

interface NavInputs {
  rooms: Room[];
  colliders: Aabb[];
  slots: PhotoSlot[];
  doorways: Doorway[];
  finale: FinaleZone;
  spawn: MuseumLayout['spawn'];
  end: number;
  bounds: Aabb;
}

/**
 * Nodes on the centreline every 2.5 m, at each doorway, at each photo standing spot, at the spawn
 * points and at the podium. Edges join every pair with clear line of sight for a character.
 */
function buildNavGraph(input: NavInputs): NavGraphData {
  const nodes: NavNode[] = [];
  const add = (p: Vec2, kind: NavNodeKind): void => {
    if (!circleIsFree(p, CHARACTER_RADIUS, input.colliders)) return;
    if (p.x < input.bounds.minX || p.x > input.bounds.maxX) return;
    if (p.z < input.bounds.minZ || p.z > input.bounds.maxZ) return;
    // Skip near-duplicates so the graph stays small.
    for (const n of nodes) {
      if (Math.hypot(n.x - p.x, n.z - p.z) < 0.4) return;
    }
    nodes.push({ id: nodes.length, x: p.x, z: p.z, kind });
  };

  // Most important nodes first, so they win over near-duplicates.
  add(input.spawn.visitor.position, 'spawn');
  add(input.spawn.guide.position, 'spawn');
  for (const door of input.doorways) add({ x: door.centerX, z: door.z }, 'door');
  add(input.finale.center, 'finale');
  for (const slot of input.slots) add(slot.standingSpot, 'photo');
  // Side nodes in every room, so a character off the centreline always has somewhere to go.
  for (const room of input.rooms) {
    const depth = room.bounds.maxZ - room.bounds.minZ;
    for (const f of [0.3, 0.7]) {
      add({ x: -2.4, z: room.bounds.maxZ - depth * f }, 'centre');
      add({ x: 2.4, z: room.bounds.maxZ - depth * f }, 'centre');
    }
  }
  for (let z = -LAYOUT.centrelineSpacing / 2; z > input.end + 0.5; z -= LAYOUT.centrelineSpacing) {
    add({ x: 0, z }, 'centre');
  }

  const edges: Array<[number, number]> = [];
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    if (!a) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      if (!b) continue;
      if (Math.hypot(a.x - b.x, a.z - b.z) > MAX_EDGE_LENGTH) continue;
      if (segmentClear(a, b, input.colliders, CHARACTER_RADIUS)) edges.push([a.id, b.id]);
    }
  }
  return { nodes, edges };
}
