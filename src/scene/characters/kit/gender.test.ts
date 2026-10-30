/**
 * CR-1 gender shape tests (ADR 0020, design spec 9.1, 9.5, 9.6, 9.7): budgets for every
 * combination, Neutral equal to the v1.0 output, width limits, silhouette separation, clipping
 * and the rig's rebuild and preview-morph behaviour.
 */
import { AVATAR_GENDERS, AVATAR_OPTIONS } from '@contract';
import type { AvatarConfig, AvatarGender } from '@contract';
import type { BufferGeometry } from 'three';
import { Group, Matrix4, SkinnedMesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ringsAt, type Ring } from './geometry/surface';
import { BONE_NAMES } from './geometry/partBuilder';
import { hashGeometry, neutralSnapshot } from './neutralSnapshot.testutil';
import { DEFAULT_GUIDE_APPEARANCE } from './options';
import { buildBodyGeometry, type AvatarRole } from './parts/body';
import { buildHairGeometry } from './parts/hair';
import { garmentFor, outfitColour } from './parts/outfits';
import { torsoRings, NECK_Y, WAIST_Y } from './parts/torso';
import {
  BASE,
  BODY_SHAPES,
  GENDER_SHAPES,
  HEAD,
  blendGender,
  heightWarp,
  jawScale,
  shapeFor,
} from './proportions';
import { createAvatarRig } from './rig';

const TRIANGLE_BUDGET = 6000;
const DRAW_CALL_BUDGET = 10;
const BONE = (name: (typeof BONE_NAMES)[number]) => BONE_NAMES.indexOf(name);

function cfg(patch: Partial<AvatarConfig>): AvatarConfig {
  return { ...DEFAULT_GUIDE_APPEARANCE, ...patch };
}
const tris = (g: BufferGeometry | null) => (g?.index ? g.index.count / 3 : 0);

/** v1.0 fingerprints, taken from the kit before CR-1 (see neutralSnapshot.testutil.ts). */
const V1_GOLDEN: Record<string, string> = {
  'body:slim': '5af56628',
  'body:regular': '1b2931b0',
  'body:curvy': '85a3a108',
  'body:broad': 'aa5bbd48',
  'hair:shaved': 'bca885ed',
  'hair:buzz': 'ce8f15d5',
  'hair:short-crop': '1dfb0975',
  'hair:side-part': '90989455',
  'hair:curly-short': '739bd7cd',
  'hair:bob': '157c6975',
  'hair:long-straight': '744301d5',
  'hair:long-wavy': '4f69de85',
  'hair:ponytail': '962dca4d',
  'hair:bun': 'a4598bad',
  'hair:afro': '7fc70a6d',
  'hair:braids': 'a766272d',
};

describe('Neutral is the v1.0 character', () => {
  it('has every multiplier at exactly 1', () => {
    for (const v of Object.values(GENDER_SHAPES.neutral)) expect(v).toBe(1);
    for (const bodyType of AVATAR_OPTIONS.bodyType) {
      const s = shapeFor(cfg({ bodyType }));
      expect(s.shoulder).toBe(BODY_SHAPES[bodyType].shoulder);
      expect(s.hip).toBe(BODY_SHAPES[bodyType].hip);
      expect(s.legs).toBe(1);
      expect(heightWarp(s)).toBeNull();
    }
  });

  it('is vertex-identical to the v1.0 output with no gender and with neutral', () => {
    expect(neutralSnapshot()).toEqual(V1_GOLDEN);
    expect(neutralSnapshot('neutral')).toEqual(V1_GOLDEN);
  });

  it('treats an unknown stored gender as Neutral', () => {
    const odd = { ...DEFAULT_GUIDE_APPEARANCE, gender: 'Woman' } as unknown as AvatarConfig;
    expect(hashGeometry(buildBodyGeometry(odd, 'guide'))).toBe(
      hashGeometry(buildBodyGeometry(cfg({}), 'guide')),
    );
  });

  it('keeps the v1.0 hip height and bone positions', () => {
    const rig = createAvatarRig(cfg({ gender: 'neutral' }), { role: 'guide' });
    expect(rig.bones.hips.position.y).toBe(BASE.hipY);
    rig.dispose();
  });
});

describe('gender shape table', () => {
  const F = GENDER_SHAPES.feminine;
  const N = GENDER_SHAPES.neutral;
  const M = GENDER_SHAPES.masculine;

  it('keeps the ordering from design spec 9.1', () => {
    for (const k of ['shoulder', 'waist', 'neck', 'limb', 'brow', 'jaw', 'torso'] as const) {
      expect(F[k], k).toBeLessThan(N[k]);
      expect(N[k], k).toBeLessThan(M[k]);
    }
    for (const k of ['hip', 'eye'] as const) {
      expect(F[k], k).toBeGreaterThan(N[k]);
      expect(N[k], k).toBeGreaterThan(M[k]);
    }
  });

  it('tunes no value more than 0.03 from the spec', () => {
    const spec = {
      feminine: {
        shoulder: 0.95,
        waist: 0.92,
        hip: 1.06,
        depth: 1.04,
        neck: 0.92,
        limb: 0.94,
        torso: 0.98,
        jaw: 0.94,
        brow: 0.9,
        eye: 1.06,
      },
      masculine: {
        shoulder: 1.07,
        waist: 1.02,
        hip: 0.97,
        depth: 1.02,
        neck: 1.12,
        limb: 1.06,
        torso: 1.02,
        jaw: 1.06,
        brow: 1.15,
        eye: 0.97,
      },
    } as const;
    for (const g of ['feminine', 'masculine'] as const) {
      for (const [k, v] of Object.entries(spec[g])) {
        const actual = GENDER_SHAPES[g][k as keyof typeof F];
        expect(Math.abs(actual - v), `${g}.${k}`).toBeLessThanOrEqual(0.03 + 1e-9);
      }
    }
  });

  it('keeps total standing height identical (torso plus legs)', () => {
    for (const g of AVATAR_GENDERS) {
      const s = shapeFor(cfg({ gender: g }));
      const total = BASE.hipY * s.legs + BASE.torsoLength * s.torso;
      expect(total, g).toBeCloseTo(BASE.hipY + BASE.torsoLength, 12);
      expect(Math.abs(s.legs - 1), g).toBeLessThan(0.03);
    }
  });

  it('blends linearly and returns the endpoints exactly', () => {
    expect(blendGender(F, M, 0)).toEqual(F);
    expect(blendGender(F, M, 1)).toEqual(M);
    expect(blendGender(F, M, 0.5).shoulder).toBeCloseTo((F.shoulder + M.shoulder) / 2, 12);
  });
});

describe('width limits (design spec 9.1): 12 gender and body type combinations', () => {
  for (const gender of AVATAR_GENDERS) {
    for (const bodyType of AVATAR_OPTIONS.bodyType) {
      it(`${gender} / ${bodyType}`, () => {
        const s = shapeFor(cfg({ gender, bodyType }));
        const shoulders = 0.4 * s.shoulder;
        const hips = 0.3 * s.hip;
        expect(shoulders).toBeGreaterThanOrEqual(0.34 - 1e-9);
        expect(shoulders).toBeLessThanOrEqual(0.5);
        expect(hips).toBeGreaterThanOrEqual(0.26 - 1e-9);
        expect(hips).toBeLessThanOrEqual(0.36);
        // The measured pelvis ring is the nominal hip width (before the garment's thickness).
        const rings = torsoRings(s, 0).pelvis;
        const widest = Math.max(...rings.map((r) => 2 * r.rx));
        expect(widest).toBeCloseTo(hips, 9);
      });
    }
  }
});

/** Width of a mesh's silhouette (x extent) at height y, from the triangles that cross it. */
function silhouetteWidth(g: BufferGeometry, y: number, bones: readonly number[] | null): number {
  const p = g.getAttribute('position');
  const skin = g.getAttribute('skinIndex');
  const idx = g.index as NonNullable<typeof g.index>;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < idx.count; i += 3) {
    const v = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)] as const;
    if (bones && !v.every((a) => bones.includes(skin.getX(a)))) continue;
    for (let a = 0; a < 3; a++) {
      for (let b = a + 1; b < 3; b++) {
        const va = v[a] as number;
        const vb = v[b] as number;
        const ya = p.getY(va);
        const yb = p.getY(vb);
        if ((ya - y) * (yb - y) <= 0 && ya !== yb) {
          const x = p.getX(va) + ((y - ya) / (yb - ya)) * (p.getX(vb) - p.getX(va));
          lo = Math.min(lo, x);
          hi = Math.max(hi, x);
        }
      }
    }
  }
  return hi - lo;
}

describe('silhouette from behind (design spec 9.6)', () => {
  const order: AvatarGender[] = ['feminine', 'neutral', 'masculine'];

  it('separates neighbouring shoulder to hip ratios by 10% or more (spec numbers)', () => {
    for (const bodyType of AVATAR_OPTIONS.bodyType) {
      const r = order.map((g) => {
        const s = shapeFor(cfg({ gender: g, bodyType }));
        return s.shoulder / s.hip;
      });
      expect((r[1] as number) / (r[0] as number) - 1).toBeGreaterThanOrEqual(0.1);
      expect((r[2] as number) / (r[1] as number) - 1).toBeGreaterThanOrEqual(0.1);
    }
  });

  it('separates them by 10% or more on the real mesh, rendered at 120 px tall', () => {
    // Shoulder row: the whole silhouette including the arms. Hip row: the torso and hips only,
    // because the arms hang beside them. Both are snapped to the pixels of a 120 px figure.
    const pixel = 1.8 / 120;
    const snap = (w: number) => Math.max(1, Math.round(w / pixel));
    for (const bodyType of AVATAR_OPTIONS.bodyType) {
      const r = order.map((gender) => {
        const g = buildBodyGeometry(cfg({ gender, bodyType, outfitStyle: 'tee-jeans' }), 'guide');
        const shoulders = silhouetteWidth(g, 1.25, null);
        const hips = silhouetteWidth(g, 0.82, [BONE('hips'), BONE('spine')]);
        return { exact: shoulders / hips, px: snap(shoulders) / snap(hips) };
      });
      const [f, n, m] = r as [(typeof r)[0], (typeof r)[0], (typeof r)[0]];
      expect(n.exact / f.exact - 1, `${bodyType} Woman to Neutral`).toBeGreaterThanOrEqual(0.1);
      expect(m.exact / n.exact - 1, `${bodyType} Neutral to Man`).toBeGreaterThanOrEqual(0.1);
      // At pixel resolution the order must still hold with a visible step.
      expect(f.px).toBeLessThan(n.px);
      expect(n.px).toBeLessThan(m.px);
    }
  });
});

describe('budgets: every gender, body type, hair style, outfit, facial hair, skin and role', () => {
  // Body and hair are separate meshes, so the character total is their sum and the worst
  // character is the worst body plus the worst hair for the same skin, facial hair and gender.
  // Checking the two lists exhaustively is therefore an exhaustive check of every character.
  const skins = ['skin-01', 'skin-10'] as const;
  const roles: AvatarRole[] = ['guide', 'visitor'];
  const SHADOW = 2;

  it('stays within 6,000 triangles and 10 draw calls, with identical counts across genders', () => {
    let worst = 0;
    let combos = 0;
    for (const skinTone of skins) {
      for (const facialHair of AVATAR_OPTIONS.facialHair) {
        const worstBody = new Map<AvatarGender, number>();
        const worstHair = new Map<AvatarGender, number>();
        const bodyCounts = new Map<string, number>();
        const hairCounts = new Map<string, number>();
        for (const gender of ['neutral', 'feminine', 'masculine'] as const) {
          let maxBody = 0;
          let maxHair = 0;
          for (const bodyType of AVATAR_OPTIONS.bodyType) {
            for (const outfitStyle of AVATAR_OPTIONS.outfitStyle) {
              for (const role of roles) {
                const g = buildBodyGeometry(
                  cfg({ gender, bodyType, outfitStyle, skinTone, facialHair }),
                  role,
                );
                const n = tris(g);
                g.dispose();
                maxBody = Math.max(maxBody, n);
                const key = `${bodyType}/${outfitStyle}/${role}`;
                if (gender === 'neutral') bodyCounts.set(key, n);
                else
                  expect(n, `body ${gender} ${key} ${skinTone} ${facialHair}`).toBe(
                    bodyCounts.get(key),
                  );
                combos++;
              }
            }
          }
          for (const hairStyle of AVATAR_OPTIONS.hairStyle) {
            const g = buildHairGeometry(cfg({ gender, hairStyle, skinTone, facialHair }));
            const n = tris(g);
            g?.dispose();
            maxHair = Math.max(maxHair, n);
            if (gender === 'neutral') hairCounts.set(hairStyle, n);
            else
              expect(n, `hair ${gender} ${hairStyle} ${skinTone} ${facialHair}`).toBe(
                hairCounts.get(hairStyle),
              );
            combos++;
          }
          worstBody.set(gender, maxBody);
          worstHair.set(gender, maxHair);
          worst = Math.max(worst, maxBody + maxHair + SHADOW);
        }
      }
    }
    expect(combos).toBeGreaterThan(1000);
    expect(worst).toBeLessThanOrEqual(TRIANGLE_BUDGET);
    // ADR 0020 measured 5,878 with the v1.0 kit. Gender adds nothing.
    expect(worst).toBe(5878);
  });

  it('matches rig.stats on the worst character and on a sample of full rigs', () => {
    for (const gender of AVATAR_GENDERS) {
      for (const role of roles) {
        const rig = createAvatarRig(
          cfg({
            gender,
            bodyType: 'slim',
            hairStyle: 'curly-short',
            outfitStyle: 'suit',
            facialHair: 'full-beard',
            skinTone: 'skin-10',
          }),
          { role },
        );
        expect(rig.stats.triangles).toBeLessThanOrEqual(TRIANGLE_BUDGET);
        expect(rig.stats.drawCalls).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
        expect(rig.stats.drawCalls).toBe(3);
        if (role === 'guide') expect(rig.stats.triangles).toBe(5878);
        rig.dispose();
      }
    }
  });

  it('is exhaustive over full rigs for the cheap axes (every gender, hair style and outfit)', () => {
    for (const gender of AVATAR_GENDERS) {
      for (const hairStyle of AVATAR_OPTIONS.hairStyle) {
        for (const outfitStyle of AVATAR_OPTIONS.outfitStyle) {
          const rig = createAvatarRig(
            cfg({
              gender,
              hairStyle,
              outfitStyle,
              facialHair: 'full-beard',
              bodyType: 'broad',
              skinTone: 'skin-10',
            }),
            { role: 'visitor' },
          );
          expect(rig.stats.triangles).toBeLessThanOrEqual(TRIANGLE_BUDGET);
          expect(rig.stats.drawCalls).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
          rig.dispose();
        }
      }
    }
  });
});

describe('same body, three shapes', () => {
  it('keeps height, head size and the label anchor identical', () => {
    const tops = AVATAR_GENDERS.map((gender) => {
      const rig = createAvatarRig(cfg({ gender, hairStyle: 'shaved' }), { role: 'visitor' });
      let top = -Infinity;
      let bottom = Infinity;
      rig.root.updateMatrixWorld(true);
      rig.root.traverse((o) => {
        if (o instanceof SkinnedMesh) {
          const p = o.geometry.getAttribute('position');
          for (let i = 0; i < p.count; i++) {
            top = Math.max(top, p.getY(i));
            bottom = Math.min(bottom, p.getY(i));
          }
        }
      });
      const anchor = rig.labelAnchor.position.y;
      const height = rig.height;
      const head = rig.bones.head.getWorldPosition(new Vector3()).y;
      rig.dispose();
      return { top, bottom, anchor, height, head };
    });
    for (const t of tops) {
      expect(t.top).toBeCloseTo((tops[0] as (typeof tops)[0]).top, 4);
      expect(t.bottom).toBeCloseTo(0, 2);
      expect(t.anchor).toBe((tops[0] as (typeof tops)[0]).anchor);
      expect(t.height).toBe(1.7);
      expect(t.head).toBeCloseTo((tops[0] as (typeof tops)[0]).head, 6);
    }
  });

  it('makes the jaw rounder for Woman and squarer for Man on the same head mesh', () => {
    const lowerHeadWidth = (gender: AvatarGender) => {
      const g = buildBodyGeometry(cfg({ gender }), 'guide');
      const p = g.getAttribute('position');
      const skin = g.getAttribute('skinIndex');
      const cy = BASE.hipY + BASE.torsoLength + HEAD.neckLength + HEAD.ry - 0.015;
      let jaw = 0;
      let equator = 0;
      for (let i = 0; i < p.count; i++) {
        if (skin.getX(i) !== BONE('head')) continue;
        const dy = p.getY(i) - cy;
        if (dy < -0.115 && dy > -0.14) jaw = Math.max(jaw, Math.abs(p.getX(i)));
        if (Math.abs(dy) < 0.012 && p.getZ(i) < 0.04)
          equator = Math.max(equator, Math.abs(p.getX(i)));
      }
      return { jaw, equator };
    };
    const [f, n, m] = (['feminine', 'neutral', 'masculine'] as const).map(lowerHeadWidth) as [
      ReturnType<typeof lowerHeadWidth>,
      ReturnType<typeof lowerHeadWidth>,
      ReturnType<typeof lowerHeadWidth>,
    ];
    expect(f.jaw).toBeLessThan(n.jaw);
    expect(n.jaw).toBeLessThan(m.jaw);
    // The skull width is untouched.
    expect(f.equator).toBeCloseTo(n.equator, 6);
    expect(m.equator).toBeCloseTo(n.equator, 6);
    expect(jawScale(0.94, 0)).toBe(1);
    expect(jawScale(0.94, 1)).toBe(1);
    expect(jawScale(0.94, -HEAD.ry)).toBeCloseTo(
      1 + (0.94 - 1) * Math.min(1, Math.PI / 2 / 1.1) ** 2,
      9,
    );
  });

  it('sizes the eyes and brows by gender without changing the part count', () => {
    const hairParts = (gender: AvatarGender) =>
      buildHairGeometry(cfg({ gender, hairStyle: 'shaved' }));
    const heightOf = (g: BufferGeometry | null) => {
      // Brows are the only head parts above the hairline in a shaved cut with this colour,
      // so the topmost 0.0 to 0.1 band above the eyes is brow vertices.
      const p = (g as BufferGeometry).getAttribute('position');
      const cy = BASE.hipY + BASE.torsoLength + HEAD.neckLength + HEAD.ry - 0.015;
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < p.count; i++) {
        const dy = p.getY(i) - cy;
        if (p.getZ(i) > 0.1 && Math.abs(p.getX(i)) > 0.03 && dy > 0.03 && dy < 0.07) {
          lo = Math.min(lo, p.getY(i));
          hi = Math.max(hi, p.getY(i));
        }
      }
      return hi - lo;
    };
    const f = heightOf(hairParts('feminine'));
    const n = heightOf(hairParts('neutral'));
    const m = heightOf(hairParts('masculine'));
    expect(f).toBeLessThan(n);
    expect(n).toBeLessThan(m);
    expect(tris(hairParts('feminine'))).toBe(tris(hairParts('masculine')));
  });
});

describe('clipping and fit (design spec 9.7)', () => {
  const shapes = AVATAR_GENDERS.flatMap((gender) =>
    AVATAR_OPTIONS.bodyType.map((bodyType) => ({ gender, bodyType })),
  );

  function mapped(rings: Ring[], warp: ((y: number) => number) | null): Ring[] {
    return warp ? rings.map((r) => ({ ...r, y: warp(r.y) })) : rings;
  }

  /**
   * Smallest gap, in metres, between the back of the torso and any hair vertex that hangs down
   * the centre of the back. Negative means the hair is buried in the back (clipping); a larger
   * number than Neutral's means a new gap. Long hair drapes over the sides of the shoulders by
   * design in v1.0, so only the centre of the back (what the Visitor sees) is measured.
   */
  function backGap(config: AvatarConfig): number | null {
    const shape = shapeFor(config);
    const warp = heightWarp(shape);
    const chest = mapped(torsoRings(shape, 0).chest, warp);
    const hair = buildHairGeometry(config, shape);
    if (!hair) return null;
    const p = hair.getAttribute('position');
    const skin = hair.getAttribute('skinIndex');
    const yLo = warp ? warp(WAIST_Y) : WAIST_Y;
    const yHi = warp ? warp(NECK_Y) : NECK_Y;
    let gap = Infinity;
    for (let i = 0; i < p.count; i++) {
      if (skin.getX(i) !== BONE('hairBack') || Math.abs(p.getX(i)) > 0.06 || p.getZ(i) > 0)
        continue;
      const y = p.getY(i);
      if (y < yLo || y > yHi) continue;
      const at = ringsAt(chest, y);
      const back = at.cz - at.rz * Math.sqrt(Math.max(0, 1 - ((p.getX(i) - at.cx) / at.rx) ** 2));
      gap = Math.min(gap, back - p.getZ(i));
    }
    return gap === Infinity ? null : gap;
  }

  it('keeps every hair style off the back and gap-free at the neck for all 12 shapes', () => {
    for (const bodyType of AVATAR_OPTIONS.bodyType) {
      for (const hairStyle of AVATAR_OPTIONS.hairStyle) {
        const neutral = backGap(cfg({ bodyType, hairStyle }));
        for (const gender of AVATAR_GENDERS) {
          const gap = backGap(cfg({ gender, bodyType, hairStyle }));
          if (neutral === null) {
            expect(gap).toBeNull();
            continue;
          }
          expect(gap, `${hairStyle} ${gender} ${bodyType}`).not.toBeNull();
          expect(gap as number, `${hairStyle} ${gender} ${bodyType} buried`).toBeGreaterThan(0.01);
          expect(
            Math.abs((gap as number) - neutral),
            `${hairStyle} ${gender} ${bodyType} gap`,
          ).toBeLessThan(0.006);
        }
      }
    }
  });

  it('keeps facial hair on the displaced jaw: no beard vertex inside the head', () => {
    const [cx, cy, cz] = [0, BASE.hipY + BASE.torsoLength + HEAD.neckLength + HEAD.ry - 0.015, 0];
    for (const gender of AVATAR_GENDERS) {
      for (const facialHair of AVATAR_OPTIONS.facialHair) {
        if (facialHair === 'none') continue;
        for (const hairStyle of AVATAR_OPTIONS.hairStyle) {
          const config = cfg({ gender, facialHair, hairStyle });
          const hair = buildHairGeometry(config) as BufferGeometry;
          const p = hair.getAttribute('position');
          const skin = hair.getAttribute('skinIndex');
          const jaw = GENDER_SHAPES[gender].jaw;
          for (let i = 0; i < p.count; i++) {
            if (skin.getX(i) !== BONE('head')) continue;
            const dy = p.getY(i) - cy;
            // Jaw and chin only. The moustache is an ellipsoid centred on the lip, half inside by design.
            if (dy > -0.07 || p.getZ(i) < 0.02) continue;
            const s = jawScale(jaw, dy);
            const d =
              ((p.getX(i) - cx) / (HEAD.rx * s)) ** 2 +
              (dy / HEAD.ry) ** 2 +
              ((p.getZ(i) - cz) / HEAD.rz) ** 2;
            expect(d, `${facialHair} ${gender} ${hairStyle} vertex ${i}`).toBeGreaterThanOrEqual(
              1 - 1e-3,
            );
          }
        }
      }
    }
  });

  it('keeps arms attached to the shoulders and the neck inside the collar for all 12 shapes', () => {
    for (const { gender, bodyType } of shapes) {
      const s = shapeFor(cfg({ gender, bodyType }));
      const warp = heightWarp(s);
      const chest = mapped(torsoRings(s, 0).chest, warp);
      const shoulderY = (warp ?? ((y: number) => y))(NECK_Y - BASE.shoulderDrop);
      const at = ringsAt(chest, shoulderY);
      const pivot = BASE.armPivotX * s.shoulder;
      expect(pivot - BASE.armRadius * s.arm, `${gender}/${bodyType} arm gap`).toBeLessThan(at.rx);
      expect(pivot, `${gender}/${bodyType} arm outside body`).toBeGreaterThan(at.rx * 0.9);
      expect(0.04 * s.neck).toBeLessThan(0.05);
    }
  });

  it('sits the badge on the chest and follows its depth, for all outfits and shapes', () => {
    for (const { gender, bodyType } of shapes) {
      for (const outfitStyle of AVATAR_OPTIONS.outfitStyle) {
        const config = cfg({ gender, bodyType, outfitStyle });
        const shape = shapeFor(config);
        const warp = heightWarp(shape);
        const ofs = garmentFor({
          style: outfitStyle,
          outfit: outfitColour(config.outfitColor),
          skin: outfitColour(config.outfitColor),
        }).chest.ofs;
        const rings = mapped(torsoRings(shape, ofs).chest, warp);
        const g = buildBodyGeometry(config, 'guide', shape);
        const p = g.getAttribute('position');
        // Badge vertices: spine-bone vertices on the front of the character's left chest near
        // y 1.15 that stand proud of the chest surface.
        const skin = g.getAttribute('skinIndex');
        let found = 0;
        for (let i = 0; i < p.count; i++) {
          if (skin.getX(i) !== BONE('spine')) continue;
          const y = p.getY(i);
          const yBadge = warp ? warp(1.15) : 1.15;
          if (Math.abs(y - yBadge) > 0.04 || p.getX(i) < 0.04 || p.getX(i) > 0.14 * shape.shoulder)
            continue;
          if (p.getZ(i) < 0.08) continue;
          const at = ringsAt(rings, y);
          const d = ((p.getX(i) - at.cx) / at.rx) ** 2 + ((p.getZ(i) - at.cz) / at.rz) ** 2;
          if (d > 1.0001) {
            found++;
            // Never floats far off the chest.
            expect(Math.sqrt(d) - 1).toBeLessThan(0.25);
          }
        }
        expect(found).toBeGreaterThan(0);
      }
    }
  });

  it('produces finite, well-bounded vertices for every gender, outfit, hair style and height', () => {
    for (const gender of AVATAR_GENDERS) {
      for (const outfitStyle of AVATAR_OPTIONS.outfitStyle) {
        for (const height of AVATAR_OPTIONS.height) {
          const rig = createAvatarRig(
            cfg({ gender, outfitStyle, height, bodyType: 'curvy', hairStyle: 'braids' }),
            { role: 'visitor' },
          );
          rig.root.traverse((o) => {
            if (!(o instanceof SkinnedMesh)) return;
            const p = o.geometry.getAttribute('position');
            for (let i = 0; i < p.count; i++) {
              expect(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))).toBe(true);
              expect(Math.abs(p.getX(i))).toBeLessThan(0.5);
              expect(p.getY(i)).toBeGreaterThan(-0.01);
            }
          });
          rig.dispose();
        }
      }
    }
  });
});

describe('rig rebuilds on a gender change', () => {
  const meshes = (rig: ReturnType<typeof createAvatarRig>) => ({
    body: rig.root.getObjectByName('body') as SkinnedMesh,
    hair: rig.root.getObjectByName('hair') as SkinnedMesh,
  });

  it('rebuilds the bind pose, the body mesh and the hair mesh', () => {
    const rig = createAvatarRig(cfg({ hairStyle: 'ponytail' }), { role: 'guide' });
    const before = meshes(rig);
    const bodyGeometry = before.body.geometry;
    const hairGeometry = before.hair.geometry;
    const armX = rig.bones.armL.position.x;
    const inverse = before.body.skeleton.boneInverses[5]?.elements.slice();
    rig.setAppearance({ ...rig.config, gender: 'masculine' });
    const after = meshes(rig);
    expect(after.body.geometry).not.toBe(bodyGeometry);
    expect(after.hair.geometry).not.toBe(hairGeometry);
    expect(rig.bones.armL.position.x).toBeGreaterThan(armX);
    expect(after.body.skeleton.boneInverses[5]?.elements).not.toEqual(inverse);
    expect(after.body).toBe(before.body);
    // A change that is not gender leaves the hair alone.
    const hairNow = after.hair.geometry;
    rig.setAppearance({ ...rig.config, outfitColor: 'coral' });
    expect(meshes(rig).hair.geometry).toBe(hairNow);
    rig.dispose();
  });

  it('ends in exactly the same shape as a fresh rig, whatever the path', () => {
    const target = cfg({
      gender: 'feminine',
      bodyType: 'curvy',
      hairStyle: 'braids',
      facialHair: 'goatee',
      outfitStyle: 'dress',
    });
    const fresh = createAvatarRig(target, { role: 'visitor' });
    const rig = createAvatarRig(cfg({ gender: 'masculine', bodyType: 'broad' }), {
      role: 'visitor',
    });
    for (const gender of ['neutral', 'masculine', 'feminine'] as const)
      rig.setAppearance({ ...rig.config, gender });
    rig.setAppearance(target);
    const hashes = (r: typeof rig) => {
      const m = meshes(r);
      return [hashGeometry(m.body.geometry), hashGeometry(m.hair.geometry)];
    };
    expect(hashes(rig)).toEqual(hashes(fresh));
    expect(rig.bones.hips.position.y).toBe(fresh.bones.hips.position.y);
    expect(rig.bones.armR.position.x).toBe(fresh.bones.armR.position.x);
    rig.dispose();
    fresh.dispose();
  });

  it('bobs the hips about the new rest height after a change', () => {
    const rig = createAvatarRig(cfg({ gender: 'feminine' }), { role: 'guide' });
    rig.resetPose();
    expect(rig.bones.hips.position.y).toBeCloseTo(BASE.hipY * shapeFor(rig.config).legs, 9);
    expect(rig.bones.hips.position.y).toBeGreaterThan(BASE.hipY);
    rig.dispose();
  });

  it('keeps stats equal across genders', () => {
    const stats = AVATAR_GENDERS.map((gender) => {
      const rig = createAvatarRig(cfg({ gender, hairStyle: 'afro', facialHair: 'full-beard' }), {
        role: 'guide',
      });
      const s = { ...rig.stats };
      rig.dispose();
      return s;
    });
    expect(stats[1]).toEqual(stats[0]);
    expect(stats[2]).toEqual(stats[0]);
  });
});

describe('preview gender morph API (design spec 9.5)', () => {
  const hashes = (rig: ReturnType<typeof createAvatarRig>) => [
    hashGeometry((rig.root.getObjectByName('body') as SkinnedMesh).geometry),
    hashGeometry((rig.root.getObjectByName('hair') as SkinnedMesh).geometry),
  ];
  const base = cfg({ hairStyle: 'long-wavy', facialHair: 'stubble', bodyType: 'curvy' });

  it('does nothing until begun, and reports false', () => {
    const rig = createAvatarRig(base, { role: 'guide' });
    const before = hashes(rig);
    expect(rig.morphing).toBe(false);
    expect(rig.setGenderMorphProgress(0.5)).toBe(false);
    expect(hashes(rig)).toEqual(before);
    rig.dispose();
  });

  it('keeps one rig: no new meshes, bones or materials while it runs', () => {
    const rig = createAvatarRig(base, { role: 'guide' });
    const children = [...rig.root.children];
    const body = rig.root.getObjectByName('body') as SkinnedMesh;
    const material = body.material;
    const skeleton = body.skeleton;
    rig.beginGenderMorph('feminine');
    expect(rig.morphing).toBe(true);
    rig.setAppearance({ ...base, gender: 'feminine' });
    for (let i = 1; i <= 15; i++) rig.setGenderMorphProgress(i / 15);
    expect(rig.root.children).toEqual(children);
    expect(rig.root.getObjectByName('body')).toBe(body);
    expect(body.material).toBe(material);
    expect(body.skeleton).toBe(skeleton);
    rig.dispose();
  });

  it('starts at the old shape, passes through the middle and ends exactly on the new shape', () => {
    const rig = createAvatarRig(base, { role: 'guide' });
    const neutral = hashes(rig);
    const hipAt = (r: typeof rig) => r.bones.armL.position.x;
    const armStart = hipAt(rig);
    rig.beginGenderMorph('masculine');
    rig.setAppearance({ ...base, gender: 'masculine' });
    // Applying the new config keeps the morph at the start shape.
    expect(rig.morphing).toBe(true);
    expect(hashes(rig)).toEqual(neutral);
    expect(rig.config.gender).toBe('masculine');
    rig.setGenderMorphProgress(0);
    expect(hashes(rig)).toEqual(neutral);
    rig.setGenderMorphProgress(0.5);
    const mid = hipAt(rig);
    expect(mid).toBeGreaterThan(armStart);
    expect(hashes(rig)).not.toEqual(neutral);
    expect(rig.setGenderMorphProgress(0.99)).toBe(true);
    expect(rig.setGenderMorphProgress(1)).toBe(false);
    expect(rig.morphing).toBe(false);
    const done = createAvatarRig({ ...base, gender: 'masculine' }, { role: 'guide' });
    expect(hashes(rig)).toEqual(hashes(done));
    expect(hipAt(rig)).toBeGreaterThan(mid);
    expect(hipAt(rig)).toBe(hipAt(done));
    // Past the end is clamped and inert.
    expect(rig.setGenderMorphProgress(2)).toBe(false);
    rig.dispose();
    done.dispose();
  });

  it('interpolates every vertex monotonically between the two end shapes', () => {
    const a = createAvatarRig({ ...base, gender: 'feminine' }, { role: 'guide' });
    const b = createAvatarRig({ ...base, gender: 'masculine' }, { role: 'guide' });
    const rig = createAvatarRig({ ...base, gender: 'feminine' }, { role: 'guide' });
    const pos = (r: typeof rig) =>
      (r.root.getObjectByName('body') as SkinnedMesh).geometry.getAttribute('position');
    rig.beginGenderMorph('masculine');
    rig.setAppearance({ ...base, gender: 'masculine' });
    rig.setGenderMorphProgress(0.5);
    const p = pos(rig);
    const pa = pos(a);
    const pb = pos(b);
    expect(p.count).toBe(pa.count);
    expect(p.count).toBe(pb.count);
    for (let i = 0; i < p.count; i += 7) {
      for (const get of [
        (q: typeof p) => q.getX(i),
        (q: typeof p) => q.getY(i),
        (q: typeof p) => q.getZ(i),
      ]) {
        const lo = Math.min(get(pa), get(pb)) - 1e-3;
        const hi = Math.max(get(pa), get(pb)) + 1e-3;
        expect(get(p)).toBeGreaterThanOrEqual(lo);
        expect(get(p)).toBeLessThanOrEqual(hi);
      }
    }
    for (const r of [a, b, rig]) r.dispose();
  });

  it('retargets from the blended shape and never queues', () => {
    const rig = createAvatarRig(base, { role: 'guide' });
    rig.beginGenderMorph('feminine');
    rig.setAppearance({ ...base, gender: 'feminine' });
    rig.setGenderMorphProgress(0.5);
    const midArm = rig.bones.armL.position.x;
    // Change of mind: head back to Neutral from the half-way shape.
    rig.beginGenderMorph('neutral');
    rig.setAppearance({ ...base, gender: 'neutral' });
    rig.setGenderMorphProgress(0);
    expect(rig.bones.armL.position.x).toBeCloseTo(midArm, 9);
    rig.setGenderMorphProgress(1);
    const neutral = createAvatarRig(base, { role: 'guide' });
    expect(hashes(rig)).toEqual(hashes(neutral));
    rig.dispose();
    neutral.dispose();
  });

  it('applies other changes during a morph without ending it, and a different gender cancels it', () => {
    const rig = createAvatarRig(base, { role: 'guide' });
    rig.beginGenderMorph('masculine');
    rig.setAppearance({ ...base, gender: 'masculine' });
    rig.setGenderMorphProgress(0.4);
    rig.setAppearance({ ...base, gender: 'masculine', hairColor: 'blonde', skinTone: 'skin-08' });
    expect(rig.morphing).toBe(true);
    // The morph still ends on the final look with the new colours.
    rig.setGenderMorphProgress(1);
    const done = createAvatarRig(
      { ...base, gender: 'masculine', hairColor: 'blonde', skinTone: 'skin-08' },
      { role: 'guide' },
    );
    expect(hashes(rig)).toEqual(hashes(done));
    // A plain setAppearance to another gender jumps straight there.
    rig.beginGenderMorph('feminine');
    rig.setAppearance({ ...rig.config, gender: 'neutral' });
    expect(rig.morphing).toBe(false);
    rig.dispose();
    done.dispose();
  });

  it('supports reduced motion and the visit: setAppearance alone shows the final shape in one step', () => {
    const rig = createAvatarRig(base, { role: 'guide' });
    rig.setAppearance({ ...base, gender: 'feminine' });
    expect(rig.morphing).toBe(false);
    const fresh = createAvatarRig({ ...base, gender: 'feminine' }, { role: 'guide' });
    expect(hashes(rig)).toEqual(hashes(fresh));
    rig.dispose();
    fresh.dispose();
  });

  it('accepts an explicit start gender when the new config was applied first', () => {
    const rig = createAvatarRig(base, { role: 'guide' });
    rig.setAppearance({ ...base, gender: 'feminine' });
    rig.beginGenderMorph('feminine', 'neutral');
    rig.setGenderMorphProgress(0);
    const neutral = createAvatarRig(base, { role: 'guide' });
    expect(hashes(rig)).toEqual(hashes(neutral));
    rig.dispose();
    neutral.dispose();
  });

  it('costs a few milliseconds a frame on the heaviest character', () => {
    const rig = createAvatarRig(
      cfg({
        hairStyle: 'curly-short',
        outfitStyle: 'suit',
        facialHair: 'full-beard',
        bodyType: 'slim',
        skinTone: 'skin-10',
      }),
      { role: 'guide' },
    );
    rig.beginGenderMorph('feminine');
    rig.setAppearance({ ...rig.config, gender: 'feminine' });
    const t0 = performance.now();
    for (let i = 1; i <= 15; i++) rig.setGenderMorphProgress(i / 15);
    const perFrame = (performance.now() - t0) / 15;
    // Generous bound for slow CI; the measured cost is about 1 to 2 ms.
    expect(perFrame).toBeLessThan(25);
    rig.dispose();
  });
});

describe('bind pose does not depend on the parent transform (BUG-6)', () => {
  const inverses = (rig: ReturnType<typeof createAvatarRig>) => {
    const mesh = rig.root.children.find((o) => o instanceof SkinnedMesh) as SkinnedMesh;
    return {
      inv: mesh.skeleton.boneInverses.map((m) => [...m.elements]),
      bind: [...mesh.bindMatrix.elements],
    };
  };
  const offsetParent = () => {
    const p = new Group();
    p.position.set(3.2, 0.6, -1.4);
    p.rotation.y = 1.1;
    p.scale.setScalar(1.5);
    p.updateMatrixWorld(true);
    return p;
  };

  it('matches a fresh rig after setAppearance and a morph frame under a moved parent', () => {
    const start = cfg({ gender: 'neutral', bodyType: 'regular' });
    const rig = createAvatarRig(start, { role: 'guide' });
    offsetParent().add(rig.root);
    const first = inverses(rig);
    expect(first.bind).toEqual([...new Matrix4().elements]);

    const next = cfg({ gender: 'feminine', bodyType: 'broad' });
    rig.setAppearance(next);
    const fresh = createAvatarRig(next, { role: 'guide' });
    expect(inverses(rig)).toEqual(inverses(fresh));

    rig.beginGenderMorph('masculine');
    rig.setGenderMorphProgress(0.5);
    const mid = createAvatarRig(next, { role: 'guide' });
    mid.beginGenderMorph('masculine', 'feminine');
    mid.setGenderMorphProgress(0.5);
    expect(inverses(rig)).toEqual(inverses(mid));

    rig.dispose();
    fresh.dispose();
    mid.dispose();
  });
});
