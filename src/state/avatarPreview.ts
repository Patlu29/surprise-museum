import type { AvatarConfig } from '@contract';

/**
 * Contract for the builder's live avatar preview, a second small <Canvas> owned by the
 * scene-developer (architecture 6.1; never mounted together with the museum canvas).
 *
 * The frontend lazily loads the first of these that exists:
 *   src/scene/preview/AvatarPreview.tsx   (default export: a React component taking these props)
 * and falls back to a text description when it is missing or WebGL is unavailable.
 */
export interface AvatarPreviewProps {
  guide: AvatarConfig;
  visitor: AvatarConfig;
  /** Names shown as DOM labels under each character, exactly as typed. May be empty. */
  guideName: string;
  visitorName: string;
  /** The character being edited; it gets the brass ring on its plinth. */
  active: 'guide' | 'visitor';
  /** Rotation of the pair about the vertical axis, in degrees. 0 is a three-quarter front view; 180 is the back view. */
  yawDegrees: number;
  /** Called when the Creator clicks a character in the preview, to switch the tab. */
  onSelectActive?: (role: 'guide' | 'visitor') => void;
  /** Called once the first frame has rendered. */
  onReady?: () => void;
  /** Called if the canvas cannot start or the context is lost, so the UI can show its fallback. */
  onError?: (error: unknown) => void;
}
