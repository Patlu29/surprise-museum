/**
 * Museum dimensions in metres (docs/architecture.md section 6.2, ADR 0009).
 * The technical-artist reads these to size materials; do not duplicate them elsewhere.
 */
export const LAYOUT = {
  roomWidth: 8,
  halfWidth: 4,
  wallHeight: 3.2,
  wallThickness: 0.2,
  doorWidth: 2.4,
  doorHeight: 2.7,
  /**
   * 7.5 m rather than the architecture's 6 m: design spec 3.4 puts the camera 4.3 to 5.1 m behind the
   * Visitor on a phone, so she must spawn at least that far from the back wall or the boom is
   * shortened and she fills the screen on arrival.
   */
  entranceDepth: 7.5,
  galleryDepthFull: 10,
  galleryDepthSmall: 6,
  finaleDepth: 8,
  photosPerRoom: 4,
  maxPhotos: 20,
  /** Near and far picture rows, measured into the room from its entrance wall. */
  nearOffsetFull: 2.5,
  farOffsetFull: 7.5,
  nearOffsetSmall: 3,
  photoBoxWidth: 1.6,
  photoBoxHeight: 1.4,
  photoCentreY: 1.55,
  frameBorder: 0.06,
  frameDepth: 0.05,
  /** The presentation zone's front-centre point sits this far off the wall. */
  zoneOffset: 0.3,
  /** Where the Visitor stands to look at a picture, measured from the wall. */
  standingDistance: 1.6,
  podiumRadius: 1.5,
  podiumHeight: 0.18,
  finaleTriggerRadius: 1.8,
  lecternWidth: 0.6,
  lecternDepth: 0.4,
  /** The podium centre sits this far past the finale room's centre, away from the doorway. */
  podiumOffset: 1,
  spawnVisitor: { x: 0, z: -4.9 },
  spawnGuide: { x: 1.0, z: -4.5 },
  /** Heading that faces -Z, the direction of the route. */
  spawnHeading: Math.PI,
  centrelineSpacing: 2.5,
} as const;
