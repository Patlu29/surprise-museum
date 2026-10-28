import { MeshLambertMaterial } from 'three';
import { SCENE_PALETTE } from '../materials/palette';
import { createLinenTexture } from '../materials/proceduralTextures';
import type { GraphicsQuality } from '../materials/quality';
import {
  applyWorldMapping,
  finaleWallMapping,
  galleryWallMapping,
} from '../materials/worldMapping';

/**
 * Own wall materials for the internal walls, so each can fade on its own without touching the
 * shared wall material. Same look as the shell walls (linen weave, shading towards the ceiling,
 * skirting), made with the same world mapping.
 */
export interface PartitionMaterials {
  /** Index-matched to the partitions in the shell. */
  materials: MeshLambertMaterial[];
  dispose(): void;
}

export function createPartitionMaterials(
  toFinale: readonly boolean[],
  quality: GraphicsQuality,
): PartitionMaterials {
  const linen = createLinenTexture(quality);
  const materials = toFinale.map((finale) =>
    applyWorldMapping(
      new MeshLambertMaterial({
        color: finale ? SCENE_PALETTE.finaleWall : SCENE_PALETTE.wall,
        map: linen,
      }),
      finale ? finaleWallMapping() : galleryWallMapping(),
    ),
  );
  return {
    materials,
    dispose() {
      for (const m of materials) m.dispose();
      linen.dispose();
    },
  };
}

/** Opacity of a partition that is between the camera and the Visitor. */
export const PARTITION_FADED_OPACITY = 0.25;
