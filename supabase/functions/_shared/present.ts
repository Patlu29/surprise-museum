/**
 * Turns stored records into the contract's response shapes, signing photo URLs on the way.
 */
import { LIMITS, type MuseumContent, type MuseumDocument, type MuseumPhoto } from '@contract';
import { photoPaths, type MuseumRecord, type PhotoRecord, type PhotoStorage } from './ports.ts';
import { ApiException } from './http.ts';

/** Signs the wall and full URLs of every photo in one batch. Photos must be ready. */
export async function toMuseumPhotos(
  storage: PhotoStorage,
  photos: PhotoRecord[],
  ttlSeconds: number = LIMITS.signedUrlTtlSeconds,
): Promise<MuseumPhoto[]> {
  if (photos.length === 0) return [];
  const paths: string[] = [];
  for (const photo of photos) {
    const p = photoPaths(photo.museumId, photo.id);
    paths.push(p.wall, p.full);
  }
  const urls = await storage.createDownloadUrls(paths, ttlSeconds);
  if (urls.length !== paths.length)
    throw new ApiException('server_error', 'Could not sign photo URLs.');

  return photos.map((photo, index) => {
    if (photo.width === null || photo.height === null || photo.lqip === null) {
      throw new ApiException('server_error', 'A photo is missing its details.');
    }
    return {
      id: photo.id,
      position: photo.position ?? index,
      caption: photo.caption,
      width: photo.width,
      height: photo.height,
      lqip: photo.lqip,
      wallUrl: urls[index * 2] ?? '',
      fullUrl: urls[index * 2 + 1] ?? '',
    };
  });
}

/** The published content, or null for a record that is not complete (never expected after publish). */
export function toMuseumContent(museum: MuseumRecord, photos: MuseumPhoto[]): MuseumContent | null {
  if (!museum.visitorName || !museum.guideName || !museum.visitorAvatar || !museum.guideAvatar) {
    return null;
  }
  return {
    title: museum.title,
    visitorName: museum.visitorName,
    guideName: museum.guideName,
    openingGreeting: museum.openingGreeting,
    closingMessage: museum.closingMessage,
    theme: museum.theme,
    visitorAvatar: museum.visitorAvatar,
    guideAvatar: museum.guideAvatar,
    photos,
  };
}

/** The editable document, or null while the museum has never been published. */
export function toMuseumDocument(
  museum: MuseumRecord,
  photos: PhotoRecord[],
): MuseumDocument | null {
  if (museum.status !== 'published') return null;
  const content = toMuseumContent(museum, []);
  if (!content) return null;
  return {
    title: content.title,
    visitorName: content.visitorName,
    guideName: content.guideName,
    openingGreeting: content.openingGreeting,
    closingMessage: content.closingMessage,
    theme: content.theme,
    visitorAvatar: content.visitorAvatar,
    guideAvatar: content.guideAvatar,
    photos: photos.map((p) => ({ photoId: p.id, caption: p.caption })),
  };
}
