import { CharacterRegistryImpl } from '../characters/CharacterRegistryImpl';
import type { MoveIntent } from '../characters/characterState';
import { LocalVisitorController } from '../characters/LocalVisitorController';
import { generateLayout } from '../layout/generateLayout';
import type { MuseumLayout, PhotoInput } from '../layout/types';
import { clamp, dist2, forwardOf, type Vec2 } from '../math/vec2';
import { NavGraph } from '../navigation/navGraph';
import { PresentationDirector } from '../presentation/PresentationDirector';
import { AutonomousGuideSource, type GuideConfig } from './AutonomousGuideSource';

/**
 * Headless world for tests and the NFR-26 soak: real layout, collision, director, Visitor
 * controller, Guide and registry, with a simulated third-person camera that sits 4 m behind
 * wherever the (simulated) user last turned it. No three.js, no browser.
 */
export interface Simulation {
  layout: MuseumLayout;
  nav: NavGraph;
  director: PresentationDirector;
  registry: CharacterRegistryImpl;
  visitor: LocalVisitorController;
  guide: AutonomousGuideSource;
  intent: MoveIntent;
  cameraYaw: number;
  reducedMotion: boolean;
  time: number;
  step(dt?: number): void;
  run(seconds: number, each?: (sim: Simulation) => void): void;
  /** Walk the Visitor straight at a point using camera-relative input. Returns the distance left. */
  steer(target: Vec2, speed?: number): number;
  stop(): void;
  visitorPos(): Vec2;
  guidePos(): Vec2;
}

export function makePhotos(n: number): PhotoInput[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    width: i % 3 === 0 ? 3000 : 4000,
    height: i % 3 === 0 ? 4000 : 3000,
  }));
}

export function createSimulation(
  photoCount = 12,
  options: {
    reducedMotion?: boolean;
    guideConfig?: Partial<GuideConfig>;
    layout?: MuseumLayout;
  } = {},
): Simulation {
  const layout = options.layout ?? generateLayout(makePhotos(photoCount));
  const nav = new NavGraph(layout);
  const director = new PresentationDirector(layout);
  const registry = new CharacterRegistryImpl();
  const intent: MoveIntent = { x: 0, y: 0 };

  const visitor = new LocalVisitorController({ layout, readIntent: () => intent });
  const guide = new AutonomousGuideSource({
    layout,
    nav,
    director,
    config: options.guideConfig,
    getView: () => ({ fovY: (58 * Math.PI) / 180, aspect: 9 / 16 }),
  });
  registry.setSource('visitor', visitor);
  registry.setSource('guide', guide);

  const sim: Simulation = {
    layout,
    nav,
    director,
    registry,
    visitor,
    guide,
    intent,
    cameraYaw: layout.spawn.visitor.heading,
    reducedMotion: options.reducedMotion ?? false,
    time: 0,
    step(dt = 1 / 30) {
      sim.time += dt;
      const v = visitor.read().position;
      const fwd = forwardOf(sim.cameraYaw);
      registry.tickAll(dt, {
        time: sim.time,
        reducedMotion: sim.reducedMotion,
        camera: {
          position: { x: v.x - fwd.x * 4, y: 2.2, z: v.z - fwd.z * 4 },
          forward: { x: fwd.x, y: -0.3, z: fwd.z },
        },
      });
    },
    run(seconds, each) {
      const steps = Math.round(seconds * 30);
      for (let i = 0; i < steps; i++) {
        sim.step();
        each?.(sim);
      }
    },
    steer(target, speed = 1) {
      const v = visitor.read().position;
      const dx = target.x - v.x;
      const dz = target.z - v.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) {
        intent.x = 0;
        intent.y = 0;
        return d;
      }
      const f = forwardOf(sim.cameraYaw);
      const right = { x: -f.z, z: f.x };
      const s = clamp(d / 0.4, 0.2, 1) * speed;
      intent.x = ((dx * right.x + dz * right.z) / d) * s;
      intent.y = ((dx * f.x + dz * f.z) / d) * s;
      return d;
    },
    stop() {
      intent.x = 0;
      intent.y = 0;
    },
    visitorPos: () => ({ x: visitor.read().position.x, z: visitor.read().position.z }),
    guidePos: () => ({ x: guide.read().position.x, z: guide.read().position.z }),
  };
  return sim;
}

/** Walk the Visitor to a point (following the nav graph) and stop. Returns false on timeout. */
export function walkVisitorTo(sim: Simulation, target: Vec2, timeoutSeconds = 90): boolean {
  const limit = Math.round(timeoutSeconds * 30);
  for (let i = 0; i < limit; i++) {
    const here = sim.visitorPos();
    const path = sim.nav.findPath(here, target);
    const next = path?.[0] ?? target;
    sim.steer(next);
    sim.step();
    if (dist2(sim.visitorPos(), target) < 0.15) {
      sim.stop();
      return true;
    }
  }
  sim.stop();
  return false;
}
