/**
 * A tiny warm environment map built at runtime (no HDR download, so nothing in `public/env/`).
 *
 * A dark-ceilinged, linen-walled box with four warm panels, prefiltered once with PMREM. It gives
 * the oak, brass and polished finale floor a soft, believable sheen. Cost: one small render at
 * start-up (a few milliseconds). High quality only; Lambert ignores it anyway.
 */
import {
  BackSide,
  BufferAttribute,
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { SCENE_PALETTE } from './palette';

export interface WarmEnvironment {
  texture: Texture;
  dispose(): void;
}

export function createWarmEnvironment(renderer: WebGLRenderer): WarmEnvironment {
  const scene = new Scene();

  // Room shell with a vertical gradient baked into vertex colours (dark ceiling, oak floor).
  const room = new BoxGeometry(10, 4, 10, 1, 4, 1);
  const pos = room.getAttribute('position');
  const colours = new Float32Array(pos.count * 3);
  const ceiling = new Color(SCENE_PALETTE.ceiling);
  const wall = new Color(SCENE_PALETTE.wall).multiplyScalar(0.55);
  const floor = new Color(SCENE_PALETTE.floor).multiplyScalar(0.5);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + 2) / 4;
    if (t > 0.75) c.copy(ceiling);
    else if (t < 0.05) c.copy(floor);
    else c.copy(wall);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  room.setAttribute('color', new BufferAttribute(colours, 3));
  const shell = new Mesh(room, new MeshBasicMaterial({ vertexColors: true, side: BackSide }));
  scene.add(shell);

  // Warm panels act as picture lights and lamps. Colour values above 1 survive in the half-float
  // PMREM target, which is what gives the highlights their punch.
  const panelMaterial = new MeshBasicMaterial({
    color: new Color(SCENE_PALETTE.lightWarm).multiplyScalar(7),
    side: BackSide,
  });
  const panelGeometry = new PlaneGeometry(3, 1.2);
  const placements: Array<[number, number, number, number]> = [
    [0, 1.2, -4.9, 0],
    [0, 1.2, 4.9, Math.PI],
    [-4.9, 1.2, 0, Math.PI / 2],
    [4.9, 1.2, 0, -Math.PI / 2],
  ];
  for (const [x, y, z, ry] of placements) {
    const m = new Mesh(panelGeometry, panelMaterial);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
  }
  // A warm ceiling lamp.
  const lamp = new Mesh(new PlaneGeometry(2, 2), panelMaterial);
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(0, 1.95, 0);
  scene.add(lamp);

  const generator = new PMREMGenerator(renderer);
  const target = generator.fromScene(scene, 0.06, 0.1, 30);
  generator.dispose();

  room.dispose();
  shell.material.dispose();
  panelMaterial.dispose();
  panelGeometry.dispose();
  lamp.geometry.dispose();

  return { texture: target.texture, dispose: () => target.dispose() };
}
