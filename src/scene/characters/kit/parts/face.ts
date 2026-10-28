/**
 * Face features on the head ellipsoid (design spec 1.6): two dark oval eyes, thin brows in the
 * hair colour, a tiny nose bump in a slightly deeper skin tone, a small smile and soft cheek
 * blush. Placed by azimuth and latitude on the head, so they always sit on the surface.
 */
import type { Color } from 'three';
import {
  BufferAttribute,
  Matrix4,
  Quaternion,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { luminance, mixColour, shade, hex } from '../colour';
import { AVATAR_FIXED, SKIN_BLUSH } from '../palette';
import { ellipsoid } from '../geometry/surface';
import { HEAD, headCentre } from '../proportions';

export interface SurfacePose {
  position: Vector3;
  normal: Vector3;
  quaternion: Quaternion;
}

const forward = new Vector3(0, 0, 1);

/** A point on the head (theta from +Z towards +X, phi above the equator) pushed out by `lift`. */
export function headSurface(theta: number, phi: number, lift = 0): SurfacePose {
  const [cx, cy, cz] = headCentre();
  const cp = Math.cos(phi);
  const position = new Vector3(
    cx + HEAD.rx * cp * Math.sin(theta),
    cy + HEAD.ry * Math.sin(phi),
    cz + HEAD.rz * cp * Math.cos(theta),
  );
  const normal = new Vector3(
    (cp * Math.sin(theta)) / HEAD.rx,
    Math.sin(phi) / HEAD.ry,
    (cp * Math.cos(theta)) / HEAD.rz,
  ).normalize();
  position.addScaledVector(normal, lift);
  const quaternion = new Quaternion().setFromUnitVectors(forward, normal);
  return { position, normal, quaternion };
}

/** An ellipsoid oriented to the head surface at (theta, phi). Radii: across, up, outwards. */
export function featureOnHead(
  theta: number,
  phi: number,
  radii: readonly [number, number, number],
  colour: Color,
  options: { lift?: number; roll?: number; segments?: number; rows?: number } = {},
): BufferGeometry {
  const pose = headSurface(theta, phi, options.lift ?? 0);
  const g = ellipsoid([0, 0, 0], radii, {
    colour,
    segments: options.segments ?? 8,
    rows: options.rows ?? 5,
  });
  const roll = new Quaternion().setFromAxisAngle(forward, options.roll ?? 0);
  const q = pose.quaternion.clone().multiply(roll);
  g.applyMatrix4(new Matrix4().compose(pose.position, q, new Vector3(1, 1, 1)));
  return g;
}

export interface FaceParts {
  eyes: BufferGeometry[];
  /** Pale eye whites, only on deep skin tones where a dark eye would otherwise vanish. */
  sclera: BufferGeometry[];
  nose: BufferGeometry;
  blush: BufferGeometry[];
  mouth: BufferGeometry;
  ears: BufferGeometry[];
}

/** Mouth colour: dark rose on light skin, light rose on deep skin, so it reads on all ten tones. */
export function mouthColour(skin: Color): Color {
  return luminance(skin) > 0.12 ? hex('#7d3b45') : hex('#e29aa6');
}

/** Latitude of the mouth, used again by beards so the smile sits on top. */
export const MOUTH_PHI = -0.43;

/** How far the smile stands off the face, so a beard never hides it. */
export function mouthLiftFor(facialHair: string): number {
  if (facialHair === 'full-beard') return 0.024;
  if (facialHair === 'goatee') return 0.006;
  return 0.0025;
}

export function buildFace(skin: Color, mouthLift = 0.0025): FaceParts {
  const eye = hex(AVATAR_FIXED.eye);
  const blush = mixColour(skin, hex(SKIN_BLUSH.hex), SKIN_BLUSH.alpha);

  const deep = luminance(skin) < 0.1;
  const eyes = [-1, 1].map((s) =>
    featureOnHead(s * 0.37, 0.04, [0.0145, 0.021, 0.008], eye, { lift: deep ? 0.0012 : -0.002 }),
  );
  const sclera = deep
    ? [-1, 1].map((s) =>
        featureOnHead(s * 0.37, 0.04, [0.0215, 0.028, 0.007], hex('#efe6dc'), { lift: -0.0015 }),
      )
    : [];
  const nose = featureOnHead(0, -0.13, [0.013, 0.012, 0.014], shade(skin, 0.92), { lift: 0.001 });
  const blushes = [-1, 1].map((s) =>
    featureOnHead(s * 0.66, -0.2, [0.03, 0.02, 0.006], blush, { lift: 0.0005, roll: s * 0.2 }),
  );

  // Smile: the lower arc of a thin torus, centred on the face.
  const arc = Math.PI * 0.68;
  const radius = 0.03;
  const torus = new TorusGeometry(radius, 0.0045, 5, 10, arc);
  torus.rotateZ(-Math.PI / 2 - arc / 2);
  torus.translate(0, radius * 0.78, 0);
  const pose = headSurface(0, MOUTH_PHI, mouthLift);
  const colour = mouthColour(skin);
  const count = torus.getAttribute('position').count;
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    data[i * 3] = colour.r;
    data[i * 3 + 1] = colour.g;
    data[i * 3 + 2] = colour.b;
  }
  torus.setAttribute('color', new BufferAttribute(data, 3));
  torus.applyMatrix4(new Matrix4().compose(pose.position, pose.quaternion, new Vector3(1, 1, 1)));

  const ears = [-1, 1].map((s) => {
    const [cx, cy] = headCentre();
    return ellipsoid([cx + s * (HEAD.rx - 0.002), cy - 0.008, 0], [0.014, 0.028, 0.02], {
      colour: shade(skin, 0.96),
      segments: 8,
      rows: 5,
    });
  });

  return { eyes, sclera, nose, blush: blushes, mouth: torus, ears };
}
