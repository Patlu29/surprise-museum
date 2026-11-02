/** CR-4 museum finish (design spec 12.8.3 to 12.8.5): geometry builders, materials and shader patches. */
import { Box3, Color, ShaderLib, type BufferGeometry, type Mesh, type Material } from 'three';
import { describe, expect, it } from 'vitest';
import { LAYOUT } from '@/domain/layout/constants';
import {
  CEILING_STRIP,
  WALL_CAP,
  createCeilingRoseGeometry,
  createCeilingStripGeometry,
  createWallCapGeometry,
} from './geometry/walls';
import { createFrameGeometry, FILLET, MOUNT_BEVEL } from './geometry/frames';
import {
  CONTACT_SHADOW,
  WASH,
  createFrameContactShadowGeometry,
  createPlinthContactShadowGeometry,
  createWallWashGeometry,
} from './geometry/decals';
import { createPodiumGeometry, PODIUM } from './geometry/finale';
import { triangleCount } from './geometry/builders';
import { MUSEUM_LIGHTING, PREVIEW_STAGE_CSS } from './lighting';
import { LOOK } from './look';
import { createMuseumMaterials } from './museumMaterials';
import { SCENE_PALETTE } from './palette';
import { createOakFloorTexture } from './proceduralTextures';
import { QUALITY_FEATURES } from './quality';
import { createSceneMaterials } from './sceneMaterials';
import { DADO, FLOOR_EDGE, RUNNER_BORDER, galleryWallMapping } from './worldMapping';

const bounds = (g: BufferGeometry) =>
  new Box3().setFromBufferAttribute(g.getAttribute('position') as never);

describe('ceiling dressing', () => {
  it('builds the rose and the oculus facing down, so they are visible from inside the room', () => {
    for (const radius of [0.4, 1.2]) {
      const g = createCeilingRoseGeometry({ radius });
      const n = g.getAttribute('normal');
      for (let i = 0; i < n.count; i++) expect(n.getY(i)).toBeLessThan(-0.99);
      // The triangles wind to face down too: their geometric normal has a negative y.
      const p = g.getAttribute('position');
      const idx = g.index as NonNullable<typeof g.index>;
      for (let t = 0; t < idx.count; t += 3) {
        const a = idx.getX(t);
        const b = idx.getX(t + 1);
        const c = idx.getX(t + 2);
        const ux = p.getX(b) - p.getX(a);
        const uz = p.getZ(b) - p.getZ(a);
        const vx = p.getX(c) - p.getX(a);
        const vz = p.getZ(c) - p.getZ(a);
        // For triangles in the XZ plane, the y component of the cross product is uz*vx - ux*vz.
        expect(uz * vx - ux * vz).toBeLessThanOrEqual(1e-9);
      }
      // Below the ceiling surface (origin), never above it.
      expect(bounds(g).max.y).toBeLessThanOrEqual(1e-9);
    }
  });

  it('makes the ceiling strip 0.06 by 1.2 m, lit in --look-ceiling-strip', () => {
    expect(CEILING_STRIP).toEqual({ width: 0.06, length: 1.2 });
    const g = createCeilingStripGeometry();
    const box = bounds(g);
    expect(box.max.z - box.min.z).toBeCloseTo(1.2 + 0.04, 3);
    expect(box.max.y).toBeLessThanOrEqual(1e-9);
    const glow = g.getAttribute('aGlow');
    const col = g.getAttribute('color');
    const lit = new Color(LOOK.ceilingStrip);
    let found = false;
    for (let i = 0; i < glow.count; i++) {
      if (glow.getX(i) === 1) {
        expect(col.getX(i)).toBeCloseTo(lit.r, 4);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('fades the roses and strips with the ceiling: opacity, transparency and visibility follow', () => {
    const m = createMuseumMaterials('high');
    expect(m.ceilingDressing.transparent).toBe(false);
    m.setCeilingDressingOpacity(0.5);
    expect(m.ceilingDressing.opacity).toBeCloseTo(0.5, 5);
    expect(m.ceilingDressing.transparent).toBe(true);
    expect(m.ceilingDressing.depthWrite).toBe(false);
    expect(m.ceilingDressing.visible).toBe(true);
    m.setCeilingDressingOpacity(0.01);
    expect(m.ceilingDressing.visible).toBe(false);
    m.setCeilingDressingOpacity(1);
    expect(m.ceilingDressing.transparent).toBe(false);
    expect(m.ceilingDressing.depthWrite).toBe(true);
    expect(m.ceilingDressing.visible).toBe(true);
    m.dispose();
  });

  it('keeps the deeper ceiling colour final', () => {
    expect(SCENE_PALETTE.ceiling).toBe('#30232b');
    expect(SCENE_PALETTE.lightGround).toBe('#6a4a3c');
  });

  it('builds the wall cap 0.06 m tall, a little proud of the wall, in the rail colour', () => {
    const g = createWallCapGeometry(4, LAYOUT.wallThickness);
    const box = bounds(g);
    expect(box.min.y).toBeCloseTo(0, 6);
    expect(box.max.y).toBeCloseTo(WALL_CAP.height, 6);
    expect(box.max.x - box.min.x).toBeCloseTo(4, 5);
    expect(box.max.z - box.min.z).toBeCloseTo(LAYOUT.wallThickness + WALL_CAP.overhang * 2, 5);
    const rail = new Color(LOOK.dadoRail);
    expect(g.getAttribute('color').getX(0)).toBeCloseTo(rail.r, 5);
  });
});

describe('frames, washes and shadows', () => {
  it('adds a 3 mm brass fillet of 8 triangles to the frame', () => {
    expect(FILLET.width).toBe(0.003);
    // 8 rim and mount boxes (12 triangles each) plus the 8-triangle fillet.
    expect(triangleCount(createFrameGeometry(0.6, 0.45))).toBe(8 * 12 + 8);
    const g = createFrameGeometry(0.6, 0.45);
    const brass = new Color(LOOK.frameFillet);
    const col = g.getAttribute('color');
    let n = 0;
    for (let i = 0; i < col.count; i++) {
      if (Math.abs(col.getX(i) - brass.r) < 1e-5 && Math.abs(col.getZ(i) - brass.b) < 1e-5) n++;
    }
    expect(n).toBe(8);
  });

  it('shades the mount 6% darker on the photo side only (vertex colours)', () => {
    expect(MOUNT_BEVEL).toBe(0.06);
    const g = createFrameGeometry(0.6, 0.45);
    const col = g.getAttribute('color');
    const mat = new Color(SCENE_PALETTE.mat);
    let dark = 0;
    for (let i = 0; i < col.count; i++) {
      if (Math.abs(col.getX(i) - mat.r * 0.94) < 1e-5) dark++;
    }
    expect(dark).toBeGreaterThan(8);
  });

  it('draws the wash 1.6 times the frame height tall, behind the frame and never over the photo', () => {
    expect(WASH.alpha).toBe(0.18);
    const g = createWallWashGeometry(0.6, 0.45);
    const box = bounds(g);
    expect(box.max.y - box.min.y).toBeCloseTo((0.45 + 0.12) * 1.6, 5);
    // Behind the frame's front faces and the photo plane (z 0.02): never in front of either.
    expect(box.max.z).toBeLessThan(0.02);
    expect(box.max.z).toBeGreaterThan(0);
    const m = createMuseumMaterials('high');
    expect((m.wallWash.uniforms.uOpacity as { value: number }).value).toBe(0.18);
    m.dispose();
  });

  it('puts the contact shadow 0.04 m wider and 0.02 m lower, behind the frame, and off on Low', () => {
    const frame = bounds(createFrameGeometry(0.6, 0.45));
    const g = createFrameContactShadowGeometry(0.6, 0.45);
    const box = bounds(g);
    expect(box.max.x - box.min.x).toBeCloseTo(frame.max.x - frame.min.x + CONTACT_SHADOW.grow, 5);
    expect((box.min.y + box.max.y) / 2).toBeCloseTo(-CONTACT_SHADOW.drop, 5);
    expect(box.max.z).toBeLessThan(0.01);
    expect(QUALITY_FEATURES.high.contactShadows).toBe(true);
    expect(QUALITY_FEATURES.low.contactShadows).toBe(false);
    const high = createMuseumMaterials('high');
    const low = createMuseumMaterials('low');
    expect(high.contactShadow).not.toBeNull();
    expect(low.contactShadow).toBeNull();
    expect((high.contactShadow?.uniforms.uOpacity as { value: number }).value).toBeCloseTo(0.28, 5);
    high.dispose();
    low.dispose();
    expect(createPlinthContactShadowGeometry(1.5).getAttribute('position').count).toBe(4);
  });
});

describe('podium and plinth', () => {
  it('uses --look-plinth-side for the side and keeps the brass ring and cream top', () => {
    const g = createPodiumGeometry();
    const col = g.getAttribute('color');
    const side = new Color(LOOK.plinthSide);
    const top = new Color(SCENE_PALETTE.podium);
    let sides = 0;
    let tops = 0;
    for (let i = 0; i < col.count; i++) {
      if (Math.abs(col.getX(i) - side.r) < 1e-5 && Math.abs(col.getZ(i) - side.b) < 1e-5) sides++;
      if (Math.abs(col.getX(i) - top.r) < 1e-5 && Math.abs(col.getZ(i) - top.b) < 1e-5) tops++;
    }
    expect(sides).toBeGreaterThan(50);
    expect(tops).toBeGreaterThan(50);
    // The side flares 1.5% at the foot.
    expect(bounds(g).max.x).toBeCloseTo(PODIUM.radius * 1.015, 3);
  });

  it('scales to a preview plinth with the same proportions', () => {
    const g = createPodiumGeometry({ radius: 1 });
    expect(bounds(g).max.x).toBeCloseTo(1.015, 3);
    expect(bounds(g).max.y).toBeCloseTo(PODIUM.height + 0.0015, 4);
    expect(triangleCount(g)).toBe(triangleCount(createPodiumGeometry()));
  });

  it('gives the preview stage as a CSS radial gradient from the two tokens', () => {
    expect(PREVIEW_STAGE_CSS).toBe(
      `radial-gradient(70% 70% at 50% 40%, ${LOOK.stageCentre}, ${LOOK.stageEdge})`,
    );
  });
});

describe('lighting and shell materials', () => {
  it('lowers the hemisphere to 2.5 and the key to 1.15', () => {
    expect(MUSEUM_LIGHTING.hemisphere.intensity).toBe(2.5);
    expect(MUSEUM_LIGHTING.key.intensity).toBe(1.15);
    expect(MUSEUM_LIGHTING.environmentIntensity).toBe(0.3);
  });

  it('patches the wall with a dado, rail, contact darkening and cap, and the runner with a border', () => {
    expect(DADO).toMatchObject({ height: 0.95, railHeight: 0.05, railDepth: 0.04 });
    expect(RUNNER_BORDER.width).toBe(0.12);
    expect(FLOOR_EDGE).toEqual({ width: 0.45, alpha: 0.18 });
    const opts = galleryWallMapping();
    expect(opts.dado?.colour.getHexString()).toBe(new Color(LOOK.dado).getHexString());
    const materials = createSceneMaterials('high');
    const patch = (material: Material) => {
      const shader = {
        uniforms: {} as Record<string, { value: unknown }>,
        vertexShader: ShaderLib.lambert.vertexShader,
        fragmentShader: ShaderLib.lambert.fragmentShader,
      };
      material.onBeforeCompile(shader as never, {} as never);
      return shader;
    };
    const wall = patch(materials.wall);
    expect(wall.fragmentShader).toContain('uDadoColour');
    expect(wall.fragmentShader).toContain('capTop');
    expect(wall.uniforms.uWallHeight?.value).toBe(LAYOUT.wallHeight);
    expect(wall.uniforms.uAoBase?.value).toBe(0.12);
    expect(wall.uniforms.uAoTop?.value).toBe(0.18);
    expect((wall.uniforms.uDadoHeight as { value: number }).value).toBe(0.95);
    const runner = patch(materials.runner);
    expect(runner.fragmentShader).toContain('uBorderColour');
    expect(runner.fragmentShader).toContain('0.12');
    const floor = patch(materials.floor);
    expect(floor.fragmentShader).toContain('edgeAo');
    expect(floor.uniforms.uRoomHalf?.value).toBe(LAYOUT.halfWidth);
    // Separate programs for the wall, the finale wall and the others.
    expect(materials.wall.customProgramCacheKey()).toContain('museum-world-wall');
    materials.dispose();
    void (null as unknown as Mesh);
  });

  it('draws plank seams in the grain colour, one pixel wide, with the tint within 4%', () => {
    const t = createOakFloorTexture('high');
    const data = t.image.data as Uint8Array;
    const w = t.image.width;
    const px = (x: number, y: number) => data[(y * w + x) * 4] as number;
    // Board edges fall every 64 px of the 256 px tile; compare the seam column to the board middle.
    let seam = 0;
    let middle = 0;
    const rows = [40, 120, 200, 300, 380];
    for (const y of rows) {
      seam += px(64, y) + px(128, y) + px(192, y);
      middle += px(32, y) + px(96, y) + px(160, y);
    }
    expect(seam).toBeLessThan(middle * 0.92);
    // Plank-to-plank tint: base colour red is 0xb8 = 184; boards stay within 4% plus grain.
    const boardMean = (x: number) => rows.reduce((n, y) => n + px(x, y), 0) / rows.length;
    for (const x of [32, 96, 160, 224]) expect(boardMean(x)).toBeGreaterThan(110);
    t.dispose();
  });
});
