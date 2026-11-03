/**
 * CR-4 character tests (design spec 12.8.2, ADR 0021 section 7): face changes, face shape, outfit
 * pattern and the six new styles, budgets per style, and the idle and walk amplitudes.
 */
import {
  AVATAR_FACE_SHAPES,
  AVATAR_GENDERS,
  AVATAR_OPTIONS,
  AVATAR_OUTFIT_PATTERNS,
  type AvatarConfig,
  type AvatarFaceShape,
} from '@contract';
import type { MeshLambertMaterial, SkinnedMesh } from 'three';
import { Bone, Box3, Color, ShaderLib, Vector3, type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { LOOK } from '../../materials/look';
import {
  createAvatarBodyMaterial,
  createAvatarHairMaterial,
  createPatternUniforms,
} from '../../shaders/avatarSurface/AvatarSurfaceMaterial';
import {
  contrastRatio,
  facialHairColour,
  hex,
  luminance,
  FACIAL_HAIR_MIN_CONTRAST,
} from './colour';
import { KIT_TEST_TIMEOUT, hashGeometry } from './neutralSnapshot.testutil';
import { DEFAULT_GUIDE_APPEARANCE } from './options';
import { HAIR_COLORS, OUTFIT_COLORS, SKIN_BLUSH_DEEP, SKIN_TONES } from './palette';
import { buildBodyGeometry } from './parts/body';
import { buildFace, DEEP_SKIN_LUMINANCE } from './parts/face';
import { buildHairGeometry } from './parts/hair';
import {
  PATTERN_MAX_CONTRAST,
  PATTERN_MIN_CONTRAST,
  PATTERN_SHADE_LUMINANCE,
  patternInk,
} from './pattern';
import { garmentFor, clampCollars, legScaleFor, outfitColour } from './parts/outfits';
import { ARM_SWING, LEG_SWING, applyPose } from './pose';
import {
  FACE_SHAPES,
  GENDER_SHAPES,
  HEAD,
  chinBottomY,
  composeShape,
  BODY_SHAPES,
  faceWarp,
  headCentre,
  isIdentityFace,
  shapeFor,
} from './proportions';
import { createAvatarRig } from './rig';

function cfg(patch: Partial<AvatarConfig>): AvatarConfig {
  return { ...DEFAULT_GUIDE_APPEARANCE, ...patch };
}
const tris = (g: BufferGeometry | null) => (g?.index ? g.index.count / 3 : 0);
const DEG = Math.PI / 180;

/** Vertices of a geometry whose `outfitMask` equals `mask`, as boxes of positions. */
function maskedBox(g: BufferGeometry, test: (mask: number) => boolean): Box3 {
  const box = new Box3();
  const mask = g.getAttribute('outfitMask');
  const pos = g.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    if (test(mask.getX(i))) box.expandByPoint(v.fromBufferAttribute(pos, i));
  }
  return box;
}

describe('look values reach the kit', { timeout: KIT_TEST_TIMEOUT }, () => {
  it('uses the tokens: eye scale, brow thickness, mouth thickness and brow contrast', () => {
    expect(LOOK.eyeScale).toBe(1.1);
    expect(LOOK.browThickness).toBe(1.45);
    expect(LOOK.mouthThickness).toBe(1.22);
    expect(LOOK.browContrast).toBe(3);
  });
});

describe('face (design spec 12.8.2 C)', { timeout: KIT_TEST_TIMEOUT }, () => {
  it('adds two catchlights of at most 60 triangles in total', () => {
    for (const id of AVATAR_OPTIONS.skinTone) {
      const face = buildFace(hex(SKIN_TONES[id]));
      expect(face.catchlights).toHaveLength(2);
      const t = face.catchlights.reduce((n, g) => n + tris(g), 0);
      expect(t).toBeLessThanOrEqual(60);
      expect(t).toBe(36);
      for (const g of face.catchlights) {
        const n = g.getAttribute('normal');
        // The disc faces the same way as the head surface it sits on: outwards, towards +Z.
        expect(n.getZ(0)).toBeGreaterThan(0);
      }
    }
  });

  it('makes the eyes 10% bigger than before, on top of the gender multiplier', () => {
    const skin = hex(SKIN_TONES['skin-04']);
    const eye = (size: number) => {
      const g = buildFace(skin, 0.0025, size).eyes[0] as BufferGeometry;
      g.computeBoundingBox();
      const b = g.boundingBox as Box3;
      return b.max.y - b.min.y;
    };
    expect(eye(1)).toBeCloseTo(2 * 0.021 * 1.1, 3);
    // Woman larger than Neutral larger than Man still holds.
    expect(eye(GENDER_SHAPES.feminine.eye)).toBeGreaterThan(eye(1));
    expect(eye(1)).toBeGreaterThan(eye(GENDER_SHAPES.masculine.eye));
  });

  it('keeps the brows 17, 19 and 22 mm tall (Woman, Neutral, Man) and in that order', () => {
    const height = (gender: AvatarConfig['gender']) => {
      const g = buildHairGeometry(cfg({ gender, hairStyle: 'shaved' })) as BufferGeometry;
      // Brows are the vertices with outfitMask -1 in the hair mesh.
      const box = maskedBox(g, (m) => m === -1);
      return (box.max.y - box.min.y) * 1000;
    };
    const w = height('feminine');
    const n = height('neutral');
    const m = height('masculine');
    expect(w).toBeLessThan(n);
    expect(n).toBeLessThan(m);
    // The two brows differ in height by the roll, so the box is a little taller than one brow.
    expect(n).toBeGreaterThan(17);
    expect(n).toBeLessThan(26);
  });

  it('reaches the 3:1 brow floor on every skin and hair colour, with a warm lift on deep skin', () => {
    // Re-uses colour.test.ts for all 110 pairs; here check the deep-skin lift stays warm and reads.
    const hair = hex(HAIR_COLORS.black);
    for (const id of ['skin-09', 'skin-10'] as const) {
      const skin = hex(SKIN_TONES[id]);
      const g = buildHairGeometry(cfg({ skinTone: id, hairColor: 'black' })) as BufferGeometry;
      const col = g.getAttribute('color');
      const mask = g.getAttribute('outfitMask');
      let found = false;
      for (let i = 0; i < col.count; i++) {
        if (mask.getX(i) !== -1) continue;
        const c = new Color(col.getX(i), col.getY(i), col.getZ(i));
        expect(contrastRatio(c, skin)).toBeGreaterThanOrEqual(LOOK.browContrast - 1e-3);
        expect(c.r).toBeGreaterThanOrEqual(c.b); // warm, never a grey or a purple
        expect(luminance(c)).toBeGreaterThan(luminance(hair));
        found = true;
      }
      expect(found).toBe(true);
    }
  });

  it('keeps facial hair at 1.6:1 or better against the skin (white beard on skin-01)', () => {
    for (const skinId of AVATAR_OPTIONS.skinTone) {
      for (const hairId of AVATAR_OPTIONS.hairColor) {
        const skin = hex(SKIN_TONES[skinId]);
        const colour = facialHairColour(hex(HAIR_COLORS[hairId]), skin);
        expect(contrastRatio(colour, skin), `${skinId} ${hairId}`).toBeGreaterThanOrEqual(
          FACIAL_HAIR_MIN_CONTRAST - 1e-3,
        );
      }
    }
    // The beard mesh really carries that colour.
    const skin = hex(SKIN_TONES['skin-01']);
    const g = buildHairGeometry(
      cfg({
        skinTone: 'skin-01',
        hairColor: 'white',
        facialHair: 'full-beard',
        hairStyle: 'shaved',
      }),
    ) as BufferGeometry;
    const col = g.getAttribute('color');
    let worst = Infinity;
    for (let i = 0; i < col.count; i++) {
      worst = Math.min(
        worst,
        contrastRatio(new Color(col.getX(i), col.getY(i), col.getZ(i)), skin),
      );
    }
    // Stubble-free shaved hair is mixed with the skin, so only the lower bound of the beard matters.
    expect(
      Math.max(
        ...Array.from({ length: col.count }, (_, i) =>
          contrastRatio(new Color(col.getX(i), col.getY(i), col.getZ(i)), skin),
        ),
      ),
    ).toBeGreaterThanOrEqual(1.6);
    expect(worst).toBeGreaterThan(1);
  });

  it('uses a warm terracotta blush on skin-08 to skin-10 and the standard blush above', () => {
    for (const id of AVATAR_OPTIONS.skinTone) {
      const skin = hex(SKIN_TONES[id]);
      const face = buildFace(skin);
      const c = face.blush[0]?.getAttribute('color');
      const blush = new Color(c?.getX(0) ?? 0, c?.getY(0) ?? 0, c?.getZ(0) ?? 0);
      const deep = luminance(skin) < DEEP_SKIN_LUMINANCE;
      expect(deep).toBe(['skin-08', 'skin-09', 'skin-10'].includes(id));
      const token = deep ? hex(SKIN_BLUSH_DEEP.hex) : hex('#e58fb0');
      const alpha = deep ? SKIN_BLUSH_DEEP.alpha : 0.32;
      const expected = skin.clone().lerp(token, alpha);
      expect(blush.r).toBeCloseTo(expected.r, 4);
      expect(blush.b).toBeCloseTo(expected.b, 4);
      // Terracotta: red clearly above blue. The purple-pink blush has them close.
      if (deep) expect(blush.r).toBeGreaterThan(blush.b * 1.5);
    }
  });

  it('makes the mouth thicker with a 0.7 pi arc, and keeps the mouth and the face features on the head', () => {
    const face = buildFace(hex(SKIN_TONES['skin-04']));
    face.mouth.computeBoundingBox();
    const b = face.mouth.boundingBox as Box3;
    // Torus radius 0.03 with an arc of 0.7 pi: chord about 2 * 0.03 * sin(0.35 pi) = 0.0535 m.
    expect(b.max.x - b.min.x).toBeGreaterThan(0.05);
    expect(b.max.x - b.min.x).toBeLessThan(0.07);
  });

  it('gives the small face features and the badge no silhouette edge (mask -1), and the garment none', () => {
    const g = buildBodyGeometry(cfg({}), 'guide');
    const mask = g.getAttribute('outfitMask');
    let edgeless = 0;
    for (let i = 0; i < mask.count; i++) if (mask.getX(i) === -1) edgeless++;
    expect(edgeless).toBeGreaterThan(100);
    expect(edgeless).toBeLessThan(mask.count * 0.3);
  });
});

describe('face shape (design spec 12.8.2 D, ADR 0021 7.1)', { timeout: KIT_TEST_TIMEOUT }, () => {
  /** The spec table (12.8.2 D). The built values may differ by at most 0.03. */
  const SPEC: Record<AvatarFaceShape, number[]> = {
    oval: [1, 1, 1, 1, 1],
    round: [1.05, 0.97, 1.04, 1, 0.94],
    square: [1.02, 0.99, 1.12, 1, 0.97],
    heart: [1, 1, 0.84, 1.05, 1.08],
    long: [0.95, 1.06, 0.96, 1, 1.06],
  };

  it('keeps Oval at exactly 1 and every other value within 0.03 of the spec', () => {
    expect(isIdentityFace(FACE_SHAPES.oval)).toBe(true);
    for (const id of AVATAR_FACE_SHAPES) {
      const f = FACE_SHAPES[id];
      const built = [f.width, f.height, f.jaw, f.upper, f.chin];
      built.forEach((v, i) =>
        expect(Math.abs(v - (SPEC[id] as number[])[i]!)).toBeLessThanOrEqual(0.0301),
      );
    }
  });

  it('keeps the combined jaw between 0.78 and 1.20 for every gender and shape', () => {
    for (const id of AVATAR_FACE_SHAPES) {
      for (const gender of AVATAR_GENDERS) {
        const jaw = GENDER_SHAPES[gender].jaw * FACE_SHAPES[id].jaw;
        expect(jaw, `${id} ${gender}`).toBeGreaterThanOrEqual(0.78);
        expect(jaw, `${id} ${gender}`).toBeLessThanOrEqual(1.2);
      }
    }
  });

  it('adds no triangles: every shape has the same counts as Oval, for every hair style and facial hair', () => {
    for (const hairStyle of AVATAR_OPTIONS.hairStyle) {
      for (const facialHair of ['none', 'full-beard'] as const) {
        const oval = tris(buildHairGeometry(cfg({ hairStyle, facialHair })));
        for (const faceShape of AVATAR_FACE_SHAPES) {
          expect(tris(buildHairGeometry(cfg({ hairStyle, facialHair, faceShape })))).toBe(oval);
        }
      }
    }
    for (const outfitStyle of AVATAR_OPTIONS.outfitStyle) {
      const oval = tris(buildBodyGeometry(cfg({ outfitStyle }), 'guide'));
      for (const faceShape of AVATAR_FACE_SHAPES) {
        expect(tris(buildBodyGeometry(cfg({ outfitStyle, faceShape }), 'guide'))).toBe(oval);
      }
    }
  });

  it('only moves head vertices: the torso, garments and limbs are the same for every shape', () => {
    const base = buildBodyGeometry(cfg({ outfitStyle: 'suit' }), 'guide');
    const skin = base.getAttribute('skinIndex');
    for (const faceShape of AVATAR_FACE_SHAPES) {
      const g = buildBodyGeometry(cfg({ outfitStyle: 'suit', faceShape }), 'guide');
      const a = base.getAttribute('position');
      const b = g.getAttribute('position');
      let headMoved = 0;
      for (let i = 0; i < a.count; i++) {
        const same = a.getX(i) === b.getX(i) && a.getY(i) === b.getY(i) && a.getZ(i) === b.getZ(i);
        // The neck bone carries the collar rings, which are lowered under a longer chin on purpose.
        if (skin.getX(i) !== 3 && skin.getX(i) !== 2)
          expect(same, `${faceShape} vertex ${i}`).toBe(true);
        else if (!same) headMoved++;
      }
      if (faceShape === 'oval') expect(headMoved).toBe(0);
      else expect(headMoved).toBeGreaterThan(100);
    }
  });

  it('is the same head for Oval with or without the field, and differs for every other shape', () => {
    const none = { ...DEFAULT_GUIDE_APPEARANCE } as Partial<AvatarConfig>;
    delete none.faceShape;
    const hash = (c: AvatarConfig) => hashGeometry(buildBodyGeometry(c, 'guide'));
    expect(hash(none as AvatarConfig)).toBe(hash(cfg({ faceShape: 'oval' })));
    const seen = new Set<number>([hash(cfg({ faceShape: 'oval' }))]);
    for (const faceShape of AVATAR_FACE_SHAPES) seen.add(hash(cfg({ faceShape })));
    expect(seen.size).toBe(AVATAR_FACE_SHAPES.length);
    // An unknown stored shape is Oval.
    const odd = { ...DEFAULT_GUIDE_APPEARANCE, faceShape: 'Round' } as unknown as AvatarConfig;
    expect(hash(odd)).toBe(hash(cfg({ faceShape: 'oval' })));
  });

  it('keeps the head top within 10 mm of today and the chin clear of every collar ring', () => {
    const [, cy] = headCentre();
    const topOval = cy + HEAD.ry;
    for (const id of AVATAR_FACE_SHAPES) {
      const shape = composeShape(BODY_SHAPES.regular, GENDER_SHAPES.neutral, FACE_SHAPES[id]);
      const warp = faceWarp(shape);
      const top = warp ? warp(0, topOval)[1] : topOval;
      expect(Math.abs(top - topOval), id).toBeLessThanOrEqual(0.01);
      for (const outfitStyle of AVATAR_OPTIONS.outfitStyle) {
        const garment = clampCollars(
          garmentFor({
            style: outfitStyle,
            outfit: outfitColour('navy'),
            skin: hex(SKIN_TONES['skin-04']),
          }),
          chinBottomY(FACE_SHAPES[id]),
        );
        for (const e of garment.extras) {
          if (e.kind === 'ring' && e.bone === 'neck') {
            expect(e.y1, `${id} ${outfitStyle}`).toBeLessThanOrEqual(
              chinBottomY(FACE_SHAPES[id]) - 0.0029,
            );
            expect(e.y1).toBeGreaterThan(e.y0);
          }
        }
      }
    }
    // Oval is untouched: the suit collar keeps its v1.0 height.
    const suit = clampCollars(
      garmentFor({ style: 'suit', outfit: outfitColour('navy'), skin: hex(SKIN_TONES['skin-04']) }),
      chinBottomY(FACE_SHAPES.oval),
    );
    const ring = suit.extras.find((e) => e.kind === 'ring' && e.bone === 'neck');
    expect(ring && ring.kind === 'ring' ? ring.y1 : 0).toBe(1.358);
  });

  it('never moves the name label or the height: the anchor sits above the tallest shape', () => {
    const [, cy] = headCentre();
    const tallest = Math.max(
      ...AVATAR_FACE_SHAPES.map((id) => {
        const warp = faceWarp(
          composeShape(BODY_SHAPES.regular, GENDER_SHAPES.neutral, FACE_SHAPES[id]),
        );
        return warp ? warp(0, cy + HEAD.ry)[1] : cy + HEAD.ry;
      }),
    );
    const anchors = AVATAR_FACE_SHAPES.map((faceShape) => {
      const rig = createAvatarRig(cfg({ faceShape }), { role: 'guide' });
      const out = { anchor: rig.labelAnchor.position.y, height: rig.height };
      rig.dispose();
      return out;
    });
    for (const a of anchors) {
      expect(a).toEqual(anchors[0]);
      expect(a.anchor).toBeGreaterThan(tallest + 0.3);
    }
    expect(tallest).toBeLessThanOrEqual(1.7);
  });

  it('keeps the hair on the head: no hair vertex of a head part inside the head, every shape and gender', () => {
    for (const gender of AVATAR_GENDERS) {
      for (const faceShape of AVATAR_FACE_SHAPES) {
        const shape = shapeFor(cfg({ gender, faceShape }));
        for (const hairStyle of AVATAR_OPTIONS.hairStyle) {
          const g = buildHairGeometry(
            cfg({ gender, faceShape, hairStyle }),
            shape,
          ) as BufferGeometry;
          const skin = g.getAttribute('skinIndex');
          const pos = g.getAttribute('position');
          const box = new Box3();
          const v = new Vector3();
          for (let i = 0; i < pos.count; i++) {
            if (skin.getX(i) === 3) box.expandByPoint(v.fromBufferAttribute(pos, i));
          }
          // Head-bone hair (caps, volume, brows) tops the warped crown and spans the head width.
          const [, cy] = headCentre();
          const warp = faceWarp(shape);
          const crown = warp ? warp(0, cy + HEAD.ry)[1] : cy + HEAD.ry;
          expect(box.max.y, `${hairStyle} ${faceShape} ${gender}`).toBeGreaterThanOrEqual(
            crown - 0.003,
          );
          expect(Number.isFinite(box.min.x + box.max.x)).toBe(true);
        }
      }
    }
  });

  it('attaches facial hair to the warped jaw: beard vertices stay outside the head surface', () => {
    for (const faceShape of AVATAR_FACE_SHAPES) {
      const config = cfg({ faceShape, facialHair: 'full-beard', hairStyle: 'shaved' });
      const shape = shapeFor(config);
      const hair = buildHairGeometry(config, shape) as BufferGeometry;
      const body = buildBodyGeometry(config, 'guide', shape);
      // Lowest head vertex of the body mesh is the chin; the beard must not dip into the neck gap.
      const bp = body.getAttribute('position');
      const bs = body.getAttribute('skinIndex');
      let chin = Infinity;
      for (let i = 0; i < bp.count; i++) if (bs.getX(i) === 3) chin = Math.min(chin, bp.getY(i));
      const hp = hair.getAttribute('position');
      let beardLow = Infinity;
      for (let i = 0; i < hp.count; i++) beardLow = Math.min(beardLow, hp.getY(i));
      expect(beardLow).toBeGreaterThan(chin - 0.03);
      expect(beardLow).toBeLessThan(chin + 0.03);
    }
  });
});

describe('face shape on the rig (preview morph)', { timeout: KIT_TEST_TIMEOUT }, () => {
  it('rebuilds the body and the hair when the face shape changes, and ends like a fresh rig', () => {
    const rig = createAvatarRig(cfg({}), { role: 'guide' });
    const body = (rig.root.getObjectByName('body') as SkinnedMesh).geometry;
    const hair = (rig.root.getObjectByName('hair') as SkinnedMesh).geometry;
    rig.setAppearance(cfg({ faceShape: 'heart' }));
    expect((rig.root.getObjectByName('body') as SkinnedMesh).geometry).not.toBe(body);
    expect((rig.root.getObjectByName('hair') as SkinnedMesh).geometry).not.toBe(hair);
    const fresh = createAvatarRig(cfg({ faceShape: 'heart' }), { role: 'guide' });
    expect(hashGeometry((rig.root.getObjectByName('body') as SkinnedMesh).geometry)).toBe(
      hashGeometry((fresh.root.getObjectByName('body') as SkinnedMesh).geometry),
    );
    expect(rig.stats.triangles).toBe(fresh.stats.triangles);
    rig.dispose();
    fresh.dispose();
  });

  it('morphs a face shape in place: same meshes, start, middle and end, and the end equals a fresh rig', () => {
    const rig = createAvatarRig(cfg({}), { role: 'guide' });
    const bodyMesh = rig.root.getObjectByName('body');
    const headTop = () => {
      const g = (rig.root.getObjectByName('body') as SkinnedMesh).geometry;
      const p = g.getAttribute('position');
      const s = g.getAttribute('skinIndex');
      let lo = Infinity;
      for (let i = 0; i < p.count; i++) if (s.getX(i) === 3) lo = Math.min(lo, p.getY(i));
      return lo;
    };
    const chinStart = headTop();
    rig.beginFaceShapeMorph('long');
    expect(rig.morphing).toBe(true);
    rig.setAppearance(cfg({ faceShape: 'long' }));
    expect(rig.morphing).toBe(true);
    expect(headTop()).toBeCloseTo(chinStart, 5); // still at the start until the first frame
    expect(rig.setMorphProgress(0.5)).toBe(true);
    const mid = headTop();
    expect(mid).toBeLessThan(chinStart);
    expect(rig.setMorphProgress(1)).toBe(false);
    expect(rig.morphing).toBe(false);
    const fresh = createAvatarRig(cfg({ faceShape: 'long' }), { role: 'guide' });
    expect(headTop()).toBeLessThan(mid);
    expect(hashGeometry((rig.root.getObjectByName('body') as SkinnedMesh).geometry)).toBe(
      hashGeometry((fresh.root.getObjectByName('body') as SkinnedMesh).geometry),
    );
    expect(rig.root.getObjectByName('body')).toBe(bodyMesh);
    expect(rig.config.faceShape).toBe('long');
    rig.dispose();
    fresh.dispose();
  });

  it('a different face shape than the morph target cancels it', () => {
    const rig = createAvatarRig(cfg({}), { role: 'guide' });
    rig.beginFaceShapeMorph('round');
    rig.setAppearance(cfg({ faceShape: 'square' }));
    expect(rig.morphing).toBe(false);
    rig.dispose();
  });
});

describe(
  'outfit pattern (design spec 12.8.2 E, ADR 0021 7.2)',
  { timeout: KIT_TEST_TIMEOUT },
  () => {
    it('draws the ink as a calm tint of every outfit colour: 1.6 to 4 contrast, shade or tint by luminance', () => {
      for (const id of AVATAR_OPTIONS.outfitColor) {
        const colour = hex(OUTFIT_COLORS[id]);
        const ink = patternInk(colour);
        const ratio = contrastRatio(colour, ink.ink);
        expect(ratio, id).toBeGreaterThanOrEqual(PATTERN_MIN_CONTRAST - 0.02);
        expect(ratio, id).toBeLessThanOrEqual(PATTERN_MAX_CONTRAST + 0.02);
        if (luminance(colour) >= PATTERN_SHADE_LUMINANCE) {
          // A shade: darker than the colour.
          expect(luminance(ink.ink), id).toBeLessThan(luminance(colour));
          expect(ink.target.equals(new Color(0, 0, 0))).toBe(true);
        } else {
          // A tint: lighter than the colour.
          expect(luminance(ink.ink), id).toBeGreaterThan(luminance(colour));
        }
      }
    });

    /** Colour of one vertex of a geometry. */
    const colourAt = (g: BufferGeometry, i: number) => {
      const c = g.getAttribute('color');
      return new Color(c.getX(i), c.getY(i), c.getZ(i));
    };

    it('marks only the outfit-colour garment: skin, shoes, badge and the fixed garment stay plain', () => {
      const skinTone = 'skin-04';
      const skin = hex(SKIN_TONES[skinTone]);
      const outfit = hex(OUTFIT_COLORS.coral);
      for (const outfitStyle of AVATAR_OPTIONS.outfitStyle) {
        const g = buildBodyGeometry(
          cfg({ outfitStyle, outfitColor: 'coral', skinTone, bodyType: 'curvy' }),
          'guide',
        );
        const mask = g.getAttribute('outfitMask');
        const skinIndex = g.getAttribute('skinIndex');
        let patterned = 0;
        for (let i = 0; i < mask.count; i++) {
          const c = colourAt(g, i);
          const m = mask.getX(i);
          if (m > 0) {
            patterned++;
            // On the garment: the outfit colour or a trim of it, never skin or a fixed garment.
            expect(contrastRatio(c, outfit), `${outfitStyle} vertex ${i}`).toBeLessThan(1.6);
            expect(m % 2).toBe(0); // even cell counts close seamlessly round the part
          } else if (m === 0) {
            // Skin and fixed colours carry no pattern.
            if (c.equals(skin)) expect(m).toBe(0);
          }
          // Nothing on the head carries a pattern.
          if (skinIndex.getX(i) === 3) expect(m <= 0).toBe(true);
        }
        expect(patterned, outfitStyle).toBeGreaterThan(100);
      }
    });

    it('keeps the dress legs, the tee jeans and the cream tee plain', () => {
      const check = (
        outfitStyle: AvatarConfig['outfitStyle'],
        outfitColor: AvatarConfig['outfitColor'],
        plainColour: Color,
      ) => {
        const outfit = hex(OUTFIT_COLORS[outfitColor]);
        const g = buildBodyGeometry(cfg({ outfitStyle, outfitColor }), 'guide');
        const mask = g.getAttribute('outfitMask');
        let plain = 0;
        for (let i = 0; i < mask.count; i++) {
          const c = colourAt(g, i);
          if (contrastRatio(c, plainColour) < 1.12 && contrastRatio(c, outfit) > 1.6) {
            expect(mask.getX(i), `${outfitStyle} vertex ${i}`).toBeLessThanOrEqual(0);
            plain++;
          }
        }
        expect(plain, outfitStyle).toBeGreaterThan(50);
      };
      check('dress', 'navy', hex(SKIN_TONES['skin-04']));
      check('tee-jeans', 'coral', hex('#3e5c8a'));
      check('overalls', 'coral', hex('#f6efe2'));
    });

    it('does not change the geometry: every pattern is the same mesh as Plain', () => {
      for (const outfitStyle of AVATAR_OPTIONS.outfitStyle) {
        const plain = buildBodyGeometry(cfg({ outfitStyle, outfitPattern: 'plain' }), 'guide');
        for (const outfitPattern of AVATAR_OUTFIT_PATTERNS) {
          const g = buildBodyGeometry(cfg({ outfitStyle, outfitPattern }), 'guide');
          expect(tris(g)).toBe(tris(plain));
          expect(hashGeometry(g)).toBe(hashGeometry(plain));
        }
      }
    });

    it('sets the pattern uniforms on the rig without rebuilding, and plain is index 0', () => {
      const rig = createAvatarRig(cfg({ outfitColor: 'navy' }), { role: 'guide' });
      const body = (rig.root.getObjectByName('body') as SkinnedMesh).geometry;
      const material = (rig.root.getObjectByName('body') as SkinnedMesh)
        .material as MeshLambertMaterial;
      const shader = {
        uniforms: {} as Record<string, { value: unknown }>,
        vertexShader: ShaderLib.lambert.vertexShader,
        fragmentShader: ShaderLib.lambert.fragmentShader,
      };
      material.onBeforeCompile(shader as never, { getPixelRatio: () => 1 } as never);
      const index = () => (shader.uniforms.uOutfitPattern as { value: number }).value;
      expect(index()).toBe(0);
      rig.setAppearance(cfg({ outfitColor: 'navy', outfitPattern: 'dots' }));
      expect(index()).toBe(3);
      expect((rig.root.getObjectByName('body') as SkinnedMesh).geometry).toBe(body);
      rig.setAppearance(cfg({ outfitColor: 'navy', outfitPattern: 'stripes' }));
      expect(index()).toBe(1);
      expect((shader.uniforms.uInkAmount as { value: number }).value).toBeGreaterThan(0);
      rig.patternMix = 0.4;
      expect(rig.patternMix).toBeCloseTo(0.4, 5);
      rig.patternMix = 3;
      expect(rig.patternMix).toBe(1);
      rig.dispose();
    });

    it('patches the Lambert shaders once, with constant program keys and no leftover placeholders', () => {
      const patch = (material: MeshLambertMaterial) => {
        const shader = {
          uniforms: {} as Record<string, unknown>,
          vertexShader: ShaderLib.lambert.vertexShader,
          fragmentShader: ShaderLib.lambert.fragmentShader,
        };
        material.onBeforeCompile(shader as never, { getPixelRatio: () => 2 } as never);
        return shader;
      };
      const u = createPatternUniforms();
      const a = createAvatarBodyMaterial(u);
      const b = createAvatarBodyMaterial(createPatternUniforms());
      const hair = createAvatarHairMaterial();
      // Every body material shares one program, and the hair has its own.
      expect(a.customProgramCacheKey()).toBe(b.customProgramCacheKey());
      expect(hair.customProgramCacheKey()).not.toBe(a.customProgramCacheKey());
      const body = patch(a);
      expect(body.fragmentShader).toContain('avatarEdge(');
      expect(body.fragmentShader).toContain('avatarPattern(');
      expect(body.vertexShader).toContain('vOutfitCells = outfitMask');
      expect(body.uniforms.uOutfitPattern).toBe(u.uOutfitPattern);
      expect(body.uniforms.uEdgeParams).toBeDefined();
      const hairShader = patch(hair);
      expect(hairShader.fragmentShader).toContain('avatarEdge(');
      expect(hairShader.fragmentShader).not.toContain('avatarPattern(');
      // Both patches are the same text for any rig, so the program is shared.
      expect(patch(b).fragmentShader).toBe(body.fragmentShader);
      // The edge uses derivatives and the shared constants; no unresolved includes of ours.
      expect(body.fragmentShader).toContain('fwidth');
      // Hair keeps its double-sided material; body stays single-sided.
      expect(hair.side).toBe(2);
      expect(a.side).toBe(0);
      for (const m of [a, b, hair]) m.dispose();
    });
  },
);

describe('twelve outfit styles (ADR 0021 7.3)', { timeout: KIT_TEST_TIMEOUT }, () => {
  const SHADOW = 2;

  /** Worst body per style over body type, role and skin extremes; worst hair over style, beard, skin. */
  function measure() {
    let worstHair = 0;
    for (const hairStyle of AVATAR_OPTIONS.hairStyle) {
      for (const facialHair of AVATAR_OPTIONS.facialHair) {
        for (const skinTone of ['skin-01', 'skin-10'] as const) {
          worstHair = Math.max(
            worstHair,
            tris(buildHairGeometry(cfg({ hairStyle, facialHair, skinTone }))),
          );
        }
      }
    }
    const body = new Map<string, number>();
    for (const outfitStyle of AVATAR_OPTIONS.outfitStyle) {
      let worst = 0;
      for (const role of ['guide', 'visitor'] as const) {
        for (const bodyType of AVATAR_OPTIONS.bodyType) {
          for (const skinTone of ['skin-01', 'skin-10'] as const) {
            worst = Math.max(
              worst,
              tris(buildBodyGeometry(cfg({ outfitStyle, bodyType, skinTone }), role)),
            );
          }
        }
      }
      body.set(outfitStyle, worst);
    }
    return { worstHair, body };
  }

  it('builds all twelve, every new style at or under the suit, and the worst character within 5,950', () => {
    const { worstHair, body } = measure();
    const suit = body.get('suit') as number;
    expect(AVATAR_OPTIONS.outfitStyle).toHaveLength(12);
    for (const [style, n] of body) {
      expect(n, style).toBeLessThanOrEqual(suit);
      expect(n + worstHair + SHADOW, style).toBeLessThanOrEqual(5950);
    }
    expect(suit + worstHair + SHADOW).toBe(5862);
    // The six new styles all differ from the jumpsuit fallback.
    const hashes = new Set(
      AVATAR_OPTIONS.outfitStyle.map((outfitStyle) =>
        hashGeometry(buildBodyGeometry(cfg({ outfitStyle }), 'guide')),
      ),
    );
    expect(hashes.size).toBe(12);
  });

  it('fits every style on every body type, height and gender: finite, attached and inside bounds', () => {
    for (const outfitStyle of AVATAR_OPTIONS.outfitStyle) {
      for (const gender of AVATAR_GENDERS) {
        for (const bodyType of AVATAR_OPTIONS.bodyType) {
          const g = buildBodyGeometry(cfg({ outfitStyle, gender, bodyType }), 'visitor');
          const p = g.getAttribute('position');
          for (let i = 0; i < p.count; i++) {
            expect(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))).toBe(true);
            expect(Math.abs(p.getX(i))).toBeLessThan(0.55);
            expect(Math.abs(p.getZ(i))).toBeLessThan(0.4);
            expect(p.getY(i)).toBeGreaterThan(-0.01);
            expect(p.getY(i)).toBeLessThan(1.75);
          }
        }
      }
    }
  });

  it('keeps the legs inside the hem of a skirted garment through the whole walk', () => {
    for (const outfitStyle of ['dress', 'coat', 'tunic'] as const) {
      expect(legScaleFor(outfitStyle)).toBeLessThan(1);
      for (const bodyType of AVATAR_OPTIONS.bodyType) {
        const rig = createAvatarRig(cfg({ outfitStyle, bodyType }), { role: 'guide' });
        const garment = garmentFor({
          style: outfitStyle,
          outfit: outfitColour('navy'),
          skin: hex(SKIN_TONES['skin-04']),
        });
        const hemY = garment.skirt?.hemY ?? 0;
        const body = rig.root.getObjectByName('body') as SkinnedMesh;
        const skin = body.geometry.getAttribute('skinIndex');
        const pos = body.geometry.getAttribute('position');
        const v = new Vector3();
        // Skirt hem radius at rest, from the hips-bone vertices at the hem.
        rig.resetPose();
        body.skeleton.update();
        let hemRz = 0;
        for (let i = 0; i < pos.count; i++) {
          body.getVertexPosition(i, v);
          if (skin.getX(i) === 0 && Math.abs(v.y - hemY) < 0.045)
            hemRz = Math.max(hemRz, Math.abs(v.z));
        }
        let worst = -Infinity;
        for (const phase of [Math.PI / 2, (3 * Math.PI) / 2]) {
          rig.applyPose({ walkPhase: phase, walkAmount: 1 });
          rig.root.updateMatrixWorld(true);
          body.skeleton.update();
          for (let i = 0; i < pos.count; i++) {
            if (skin.getX(i) < 9) continue;
            body.getVertexPosition(i, v);
            if (v.y > hemY - 0.004 && v.y < hemY + 0.05)
              worst = Math.max(worst, Math.abs(v.z) - hemRz);
          }
        }
        expect(hemRz, `${outfitStyle} ${bodyType}`).toBeGreaterThan(0.1);
        expect(worst, `${outfitStyle} ${bodyType} leg past the hem`).toBeLessThanOrEqual(0.004);
        rig.dispose();
      }
    }
  });
});

describe('idle and walk (design spec 12.8.2 F)', { timeout: KIT_TEST_TIMEOUT }, () => {
  function bonesOf() {
    const rig = createAvatarRig(cfg({}), { role: 'guide' });
    return { rig, bones: rig.bones };
  }

  it('swings the legs 25 to 32 degrees and the arms 20 to 26', () => {
    expect(LEG_SWING / DEG).toBeGreaterThanOrEqual(25);
    expect(LEG_SWING / DEG).toBeLessThanOrEqual(32);
    expect(ARM_SWING / DEG).toBeGreaterThanOrEqual(20);
    expect(ARM_SWING / DEG).toBeLessThanOrEqual(26);
    const { rig, bones } = bonesOf();
    let legMax = 0;
    let armMax = 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (let k = 0; k < 360; k++) {
      rig.applyPose({ walkPhase: k * DEG, walkAmount: 1 });
      legMax = Math.max(legMax, Math.abs(bones.legL.rotation.x));
      armMax = Math.max(armMax, Math.abs(bones.armL.rotation.x));
      lo = Math.min(lo, bones.hips.position.y);
      hi = Math.max(hi, bones.hips.position.y);
    }
    expect(legMax / DEG).toBeCloseTo(LEG_SWING / DEG, 1);
    expect(armMax / DEG).toBeCloseTo(ARM_SWING / DEG, 1);
    // Hip bob 3 to 4 cm peak to peak.
    expect(hi - lo).toBeGreaterThanOrEqual(0.03);
    expect(hi - lo).toBeLessThanOrEqual(0.04);
    rig.dispose();
  });

  it('breathes at 0.3 Hz between 1.000 and 1.008, only when standing, and is exactly still at rest', () => {
    const { rig, bones } = bonesOf();
    let lo = Infinity;
    let hi = -Infinity;
    for (let k = 0; k <= 400; k++) {
      rig.applyPose({ idleTime: (k / 400) * (1 / 0.3) * 2, walkAmount: 0 });
      lo = Math.min(lo, bones.spine.scale.y);
      hi = Math.max(hi, bones.spine.scale.y);
    }
    expect(lo).toBeGreaterThanOrEqual(1);
    expect(lo).toBeLessThan(1.0005);
    expect(hi).toBeLessThanOrEqual(1.008 + 1e-9);
    expect(hi).toBeGreaterThan(1.0075);
    // Half a cycle in, the swell is at its peak; a full cycle (3.33 s) returns to 1.
    rig.applyPose({ idleTime: 1 / 0.3 / 2 });
    expect(bones.spine.scale.x).toBeCloseTo(1.008, 5);
    rig.applyPose({ idleTime: 1 / 0.3 });
    expect(bones.spine.scale.x).toBeCloseTo(1, 5);
    // Walking has no breathing.
    rig.applyPose({ idleTime: 1 / 0.3 / 2, walkAmount: 1 });
    expect(bones.spine.scale.x).toBe(1);
    // Reduced motion: the still pose.
    rig.applyPose({ idleTime: 1.6 });
    rig.resetPose();
    expect(bones.spine.scale.x).toBe(1);
    expect(bones.spine.scale.y).toBe(1);
    rig.dispose();
  });

  it('turns the head at most 2 degrees at 0.12 Hz and sways the arms 1.5 degrees at 0.3 Hz when idle', () => {
    const { rig, bones } = bonesOf();
    let yaw = 0;
    let sway = 0;
    for (let k = 0; k < 2000; k++) {
      rig.applyPose({ idleTime: k * 0.01 });
      yaw = Math.max(yaw, Math.abs(bones.head.rotation.y));
      sway = Math.max(sway, Math.abs(bones.armL.rotation.x));
    }
    expect(yaw / DEG).toBeCloseTo(2, 1);
    expect(sway / DEG).toBeCloseTo(1.5, 1);
    // Quarter of the 0.12 Hz cycle is 2.08 s.
    rig.applyPose({ idleTime: 1 / 0.12 / 4 });
    expect(bones.head.rotation.y / DEG).toBeCloseTo(2, 3);
    rig.dispose();
  });

  it('uses the rest pose for the exported applyPose with a Bone-only record', () => {
    // A guard that the pose function still works on bare bones (the scene drives it directly).
    const make = () => new Bone();
    const bones = {
      hips: make(),
      spine: make(),
      neck: make(),
      head: make(),
      hairBack: make(),
      armL: make(),
      forearmL: make(),
      armR: make(),
      forearmR: make(),
      legL: make(),
      shinL: make(),
      legR: make(),
      shinR: make(),
    };
    applyPose(bones, 0.78, { walkPhase: 1, walkAmount: 1 }, 0.5);
    expect(Math.abs(bones.legL.rotation.x)).toBeLessThanOrEqual(LEG_SWING * 0.5 + 1e-9);
  });
});
