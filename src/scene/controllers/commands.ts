import type { Vec2 } from '@/domain/math/vec2';
import { useMuseumStore } from '@/state/museumStore';
import { useSessionStore } from '@/state/sessionStore';
import type { FollowCameraRig } from '../cameras/FollowCameraRig';
import type { PresentationCameraController } from '../cameras/PresentationCameraController';
import { isReducedMotion } from '../runtime/motion';
import type { SceneRuntime } from '../runtime/SceneRuntime';
import { jumpTo, replay } from './actions';
import { computeHint } from './hint';
import { FRAME_COMMANDS } from './frameQueue';

/**
 * Wires the UI's command counters (sessionStore, museumStore) to the scene. Subscriptions only
 * queue work; the SceneDriver runs it at the start of the next frame, so the simulation is never
 * changed mid-tick. Returns an unsubscribe function.
 */
export function installCommands(
  runtime: SceneRuntime,
  rig: FollowCameraRig,
  presenter: PresentationCameraController,
): () => void {
  const queue = (fn: () => void): void => {
    FRAME_COMMANDS.queue.push(fn);
  };
  const visitorPos = (): Vec2 => {
    const p = runtime.registry.getSource('visitor').read().position;
    return { x: p.x, z: p.z };
  };

  const unsubscribers = [
    // Close, Keep exploring, Escape, Enter on the canvas (A-19).
    useSessionStore.subscribe(
      (s) => s.dismissSeq,
      () => queue(() => runtime.director.dismiss()),
    ),
    useSessionStore.subscribe(
      (s) => s.replaySeq,
      () => queue(() => replay(runtime, rig)),
    ),
    useSessionStore.subscribe(
      (s) => s.jump,
      (jump) => {
        if (jump) queue(() => jumpTo(runtime, rig, jump.target));
      },
    ),
    useSessionStore.subscribe(
      (s) => s.resetViewSeq,
      () =>
        queue(() => {
          // Reset view during a presentation: the camera hands over where it is, then eases to
          // the default behind the Visitor (design spec 6.12.7). The presentation continues.
          presenter.beforeReset();
          const heading = runtime.registry.getSource('visitor').read().heading;
          rig.requestReset(heading, isReducedMotion());
        }),
    ),
    useSessionStore.subscribe(
      (s) => s.hintSeq,
      () =>
        queue(() => {
          const session = useSessionStore.getState();
          const from = visitorPos();
          const hint = computeHint(runtime.layout, runtime.nav, from, session.viewed, rig.yaw);
          runtime.hint.target = hint.target.kind === 'photo' ? hint.target.photoId : 'finale';
          runtime.hint.until = runtime.time + 6;
          // On screen if the target is roughly ahead (within the camera's horizontal view).
          const onScreen =
            Math.min(hint.bearingDeg, 360 - hint.bearingDeg) <
            (rig.fovYRadians * 180) / Math.PI / 2;
          session.setHint({ ...hint, onScreen });
        }),
    ),
    // Retry from the DOM chip or the viewer (FR-58).
    // museumStore has no selector middleware, so compare the command object by identity.
    (() => {
      let previous = useMuseumStore.getState().retryRequest;
      return useMuseumStore.subscribe((state) => {
        const request = state.retryRequest;
        if (request && request !== previous) runtime.photos.retry(request.photoId);
        previous = request;
      });
    })(),
  ];
  return () => {
    for (const off of unsubscribers) off();
  };
}
