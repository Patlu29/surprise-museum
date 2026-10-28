import type { HintInfo } from '@/state/sessionStore';

/**
 * Wording for the polite live region (design spec 8.3). Pure, so the sentences are unit tested
 * and the scene and UI always say the same thing.
 */

export function photoLabel(index: number, total: number): string {
  return `Photo ${index + 1} of ${total}`;
}

/** "{Guide}, photo 3 of 12: {caption}". With no caption: "Photo 3 of 12" (FR-63). */
export function presentationAnnouncement(
  guideName: string,
  index: number,
  total: number,
  caption: string,
): string {
  const label = photoLabel(index, total);
  const text = caption.trim();
  return text ? `${guideName}, ${label.toLowerCase()}: ${text}` : label;
}

export function finaleAnnouncement(guideName: string): string {
  return `Finale. ${guideName} is sharing a note.`;
}

export function areaAnnouncement(
  kind: 'entrance' | 'gallery' | 'finale',
  index: number,
  count: number,
): string {
  if (kind === 'entrance') return 'Entrance hall';
  if (kind === 'finale') return 'Finale room';
  return `Gallery ${index} of ${count}`;
}

export const REPLAY_ANNOUNCEMENT = 'Back at the entrance. Viewed pictures have been cleared.';

export function failedPhotoAnnouncement(index: number): string {
  return `Photo ${index + 1} did not load. A Retry button is available.`;
}

export function jumpAnnouncement(index: number, total: number): string {
  return `Moved to ${photoLabel(index, total).toLowerCase()}`;
}

/** Number of galleries for a photo count (ADR 0009: four pictures per room, one to five rooms). */
export function galleryCount(photoCount: number): number {
  return Math.max(1, Math.min(5, Math.ceil(photoCount / 4)));
}

/** The hidden description read on Start (design spec 8.3). */
export function sceneDescription(title: string, guideName: string, photoCount: number): string {
  const galleries = galleryCount(photoCount);
  const pictures = photoCount === 1 ? '1 picture hangs' : `${photoCount} pictures hang`;
  const rooms = galleries === 1 ? 'a gallery' : `${galleries} galleries`;
  return `You are in the entrance hall of ${title}. ${pictures} along ${rooms}, leading to a finale room. ${guideName}, your guide, is beside you. Walk freely. Pause by a picture and ${guideName} will tell you about it.`;
}

const SECTORS = [
  'ahead',
  'ahead on your right',
  'on your right',
  'behind you on your right',
  'behind you',
  'behind you on your left',
  'on your left',
  'ahead on your left',
] as const;

export function directionPhrase(bearingDeg: number): string {
  const normalised = ((bearingDeg % 360) + 360) % 360;
  const index = Math.round(normalised / 45) % 8;
  return SECTORS[index] ?? 'ahead';
}

/** "Nearest picture you haven't seen: photo 4 of 12, about 9 metres ahead on your left". */
export function hintAnnouncement(
  hint: HintInfo,
  index: number,
  total: number,
  guideName: string,
): string {
  const metres = Math.max(1, Math.round(hint.distanceM));
  const where = `about ${metres} ${metres === 1 ? 'metre' : 'metres'} ${directionPhrase(hint.bearingDeg)}`;
  if (hint.target.kind === 'finale') {
    return `You have seen every picture. The finale, where ${guideName} has a note for you, is ${where}.`;
  }
  return `Nearest picture you haven't seen: ${photoLabel(index, total).toLowerCase()}, ${where}`;
}
