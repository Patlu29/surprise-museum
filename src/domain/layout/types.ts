import type { Aabb } from '../navigation/geometry';
import type { Vec2 } from '../math/vec2';
import type { Vec3 } from '../characters/characterState';

export interface PhotoInput {
  id: string;
  /** Pixel size of the photo; only the aspect ratio is used (FR-39). */
  width: number;
  height: number;
}

export type RoomKind = 'entrance' | 'gallery' | 'finale';

export interface Room {
  id: string;
  kind: RoomKind;
  /** 1-based gallery number for galleries, 0 otherwise. */
  galleryIndex: number;
  /** Interior bounds, ignoring wall thickness. minZ is the far end (more negative). */
  bounds: Aabb;
  /** Photo ids hung in this room, in slot order (left-near, right-near, left-far, right-far). */
  photoIds: string[];
}

export type WallSide = 'left' | 'right';

export interface PhotoSlot {
  photoId: string;
  /** 0-based position in the Creator's order. */
  index: number;
  roomIndex: number;
  wall: WallSide;
  /** Centre of the picture on the wall surface. */
  position: Vec3;
  /** Unit normal pointing into the room, in plan. */
  normal: Vec2;
  /** Picture size, fitted inside 1.6 by 1.4 m at the photo's aspect ratio. */
  width: number;
  height: number;
  /** Outer size including the frame border. */
  frameWidth: number;
  frameHeight: number;
  /** Front-centre point of the presentation zone, 0.3 m off the wall. */
  zonePoint: Vec2;
  /** Where the Visitor stands for a good view; also a navigation node. */
  standingSpot: Vec2;
}

export interface Doorway {
  /** Plan z of the wall the opening cuts through. */
  z: number;
  centerX: number;
  width: number;
  height: number;
  /** Index of the room the doorway leads into. */
  toRoomIndex: number;
}

/** An internal wall with a doorway. Its colliders are the two segments either side of the opening. */
export interface Partition {
  /** Plan z of the wall. */
  z: number;
  /** Index of the room the doorway leads into. */
  toRoomIndex: number;
  colliders: Aabb[];
}

export interface FinaleZone {
  roomIndex: number;
  /** Podium centre. */
  center: Vec2;
  /** Visible podium disc radius. */
  radius: number;
  /** Stepping inside this starts the finale. */
  triggerRadius: number;
  /** Past this the finale ends (trigger radius plus 1 m). */
  exitRadius: number;
  lectern: Aabb;
}

export type NavNodeKind = 'centre' | 'door' | 'photo' | 'spawn' | 'finale';

export interface NavNode {
  id: number;
  x: number;
  z: number;
  kind: NavNodeKind;
}

export interface NavGraphData {
  nodes: NavNode[];
  /** Undirected edges between node ids; every edge has clear line of sight for a character. */
  edges: Array<[number, number]>;
}

export interface MuseumLayout {
  rooms: Room[];
  /** Solid boxes at true size. Navigation inflates them by the character radius. */
  colliders: Aabb[];
  slots: PhotoSlot[];
  doorways: Doorway[];
  /**
   * Internal walls. They are also in `colliders`. The camera may pass behind them (they fade);
   * everything in `hardColliders` still stops the camera.
   */
  partitions: Partition[];
  /** Colliders minus the partitions: the outer walls and the lectern. */
  hardColliders: Aabb[];
  finale: FinaleZone;
  spawn: {
    visitor: { position: Vec2; heading: number };
    guide: { position: Vec2; heading: number };
  };
  navGraph: NavGraphData;
  /** Outer interior bounds of the whole walkable area. */
  bounds: Aabb;
  wallHeight: number;
  wallThickness: number;
}
