/**
 * Graphics quality tiers for the museum look.
 *
 * `low` is for phones that struggle or for a Visitor who chose "lower graphics": Lambert
 * materials only, half-size textures, no image-based lighting, no finale light cone and no dust
 * motes (design spec 1.5: "Low graphics quality: no cone mesh, floor pool only"). `high` is the
 * default.
 */
export type GraphicsQuality = 'low' | 'high';

export interface QualityFeatures {
  /** Use MeshStandardMaterial (soft specular sheen) on the floors and brass. */
  standardMaterials: boolean;
  /** Build and apply the warm image-based environment. */
  environmentMap: boolean;
  /** Draw the finale light cone mesh. */
  finaleCone: boolean;
  /** Draw dust motes in the finale cone. */
  dustMotes: boolean;
  /** Texture resolution multiplier. */
  textureScale: number;
}

export const QUALITY_FEATURES: Readonly<Record<GraphicsQuality, QualityFeatures>> = {
  high: {
    standardMaterials: true,
    environmentMap: true,
    finaleCone: true,
    dustMotes: true,
    textureScale: 1,
  },
  low: {
    standardMaterials: false,
    environmentMap: false,
    finaleCone: false,
    dustMotes: false,
    textureScale: 0.5,
  },
};
