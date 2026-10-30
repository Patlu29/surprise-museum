import { Group, Vector3, type SkinnedMesh } from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GUIDE_APPEARANCE } from '@/domain/characters/avatarOptions';
import { buildPreviewAvatar } from './previewAvatar';

/**
 * BUG-6: in the builder preview the rig sits under a plinth group (offset and turned). A change
 * of gender or body type rebuilds the bind pose, which used to bake that parent transform into
 * the skeleton inverses and draw the body displaced. After the change the rig root's transform
 * must be unchanged and the body must be where a fresh rig of the same look puts it.
 */
function bodyVertex(root: Group): Vector3 {
  const body = root.getObjectByName('body') as SkinnedMesh;
  const out = new Vector3();
  // A vertex near the hip, after skinning, in the mesh's own space.
  body.getVertexPosition(Math.floor(body.geometry.attributes.position!.count / 3), out);
  return out;
}

function inPlinth() {
  const parent = new Group();
  parent.position.set(-0.85, 0.06, 0);
  parent.rotation.y = 0.32;
  const rig = buildPreviewAvatar(DEFAULT_GUIDE_APPEARANCE, 'guide');
  parent.add(rig.root);
  parent.updateMatrixWorld(true); // as a rendered frame leaves it
  return { parent, rig };
}

describe('preview rig under a plinth', () => {
  it.each([
    ['gender', { gender: 'feminine' as const }],
    ['body type', { bodyType: 'broad' as const }],
    ['both', { gender: 'masculine' as const, bodyType: 'curvy' as const }],
  ])('keeps the root transform and the body in place after a %s change', (_n, change) => {
    const { parent, rig } = inPlinth();
    const before = rig.root.position.clone();
    const scale = rig.root.scale.clone();
    const next = { ...DEFAULT_GUIDE_APPEARANCE, ...change };
    rig.update(next, true);
    rig.stepMorph(1);
    expect(rig.root.position.equals(before)).toBe(true);
    expect(rig.root.scale.equals(scale)).toBe(true);
    expect(rig.root.parent).toBe(parent);

    const fresh = buildPreviewAvatar(next, 'guide');
    const a = bodyVertex(rig.root);
    const b = bodyVertex(fresh.root);
    expect(a.distanceTo(b)).toBeLessThan(1e-4);
  });

  it('also holds through an animated gender morph, frame by frame', () => {
    const { rig } = inPlinth();
    const next = { ...DEFAULT_GUIDE_APPEARANCE, gender: 'feminine' as const };
    rig.update(next, false);
    for (let i = 0; i < 20; i++) rig.stepMorph(0.016);
    const fresh = buildPreviewAvatar(next, 'guide');
    expect(bodyVertex(rig.root).distanceTo(bodyVertex(fresh.root))).toBeLessThan(1e-4);
  });
});
