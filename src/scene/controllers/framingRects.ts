import type { PerspectiveCamera } from 'three';
import { pictureVisibleFraction, type Rect } from '@/domain/camera/presentationFraming';
import type { SceneRuntime } from '../runtime/SceneRuntime';
import { avatarHeight } from '../characters/avatarRig';
import { characterCorners, frameCorners, projectPoints } from './projection';

/**
 * QA hook value (design spec 6.12.9): the share of the active picture's rectangle that is inside
 * the viewport and not covered by a character or a name label. Read from the live camera and the
 * labels' on-screen boxes when asked, never per frame, and uses no pixels.
 */
export function computePictureVisibleFraction(
  rt: SceneRuntime,
  camera: PerspectiveCamera | null,
  canvas: HTMLCanvasElement | null,
  photoId: string | null,
): number {
  if (!camera || !canvas || !photoId) return 0;
  const slot = rt.layout.slots.find((s) => s.photoId === photoId);
  if (!slot) return 0;
  const box = canvas.getBoundingClientRect();
  const area = { left: box.left, top: box.top, width: box.width, height: box.height };
  const picture = projectPoints(frameCorners(slot), camera, area);
  if (!picture) return 0;
  const toRect = (r: { x: number; y: number; width: number; height: number }): Rect => ({
    left: r.x,
    top: r.y,
    right: r.x + r.width,
    bottom: r.y + r.height,
  });
  const covers: Rect[] = [];
  for (const role of ['visitor', 'guide'] as const) {
    const s = rt.registry.getSource(role).read();
    const height = avatarHeight(
      role === 'visitor' ? rt.content.visitorAvatar : rt.content.guideAvatar,
    );
    // The Guide is not covering anything while she is invisible.
    if (s.opacity > 0.05) {
      const body = projectPoints(
        characterCorners(s.position.x, s.position.z, height, camera),
        camera,
        area,
      );
      if (body) covers.push(toRect(body));
    }
    const el = rt.labels.get(role);
    if (el && Number(el.style.opacity || 0) > 0.05) {
      const r = el.getBoundingClientRect();
      covers.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    }
  }
  return pictureVisibleFraction(
    toRect(picture),
    { width: area.width, height: area.height },
    covers,
  );
}
