import type { AvatarConfig, MuseumContent, MuseumDocument } from '@contract';
import { LIMITS } from '@contract';
import { avatarsEqual, DEFAULT_GUIDE_AVATAR, DEFAULT_VISITOR_AVATAR } from '@/lib/avatars';
import { codePointLength, sanitiseMultiline, sanitiseSingleLine } from '@/lib/text';

/**
 * The Creator's draft: types and pure functions (validation, document and preview building).
 * Kept free of stores and the network so they are easy to unit test.
 */

export type BuilderStep = 1 | 2 | 3 | 4;

export const BUILDER_STEPS: ReadonlyArray<{ step: BuilderStep; label: string }> = [
  { step: 1, label: 'Photos' },
  { step: 2, label: 'Words' },
  { step: 3, label: 'Characters' },
  { step: 4, label: 'Review and publish' },
];

export type PhotoStatus = 'queued' | 'processing' | 'uploading' | 'ready' | 'failed';

/** Why a photo failed, so the row can offer the right words and the right retry. */
export type PhotoErrorKind =
  'unreadable' | 'heic' | 'network' | 'rejected' | 'quota' | 'expired' | 'other';

export interface DraftPhoto {
  /** Stable local id, used as the React key and to find the photo's blobs. */
  localId: string;
  /** Server photo id after `reserve-photo`; null until then. */
  photoId: string | null;
  fileName: string;
  status: PhotoStatus;
  /** 0 to 1 while uploading. */
  progress: number;
  /** Creator-safe message when `status` is 'failed'. */
  error: string | null;
  errorKind: PhotoErrorKind | null;
  caption: string;
  /** Size of the full rendition, once processed. */
  width: number;
  height: number;
  lqip: string;
  /** Object URLs of the processed renditions (the preview and the thumbnails use them). */
  wallUrl: string;
  fullUrl: string;
  /** True once the renditions exist locally, even if the upload has not finished. */
  processed: boolean;
}

export interface DraftFields {
  title: string;
  visitorName: string;
  guideName: string;
  closingMessage: string;
  guideAvatar: AvatarConfig;
  visitorAvatar: AvatarConfig;
}

export function createInitialFields(): DraftFields {
  return {
    title: '',
    visitorName: '',
    guideName: '',
    closingMessage: '',
    guideAvatar: { ...DEFAULT_GUIDE_AVATAR },
    visitorAvatar: { ...DEFAULT_VISITOR_AVATAR },
  };
}

export interface DraftIssue {
  /** Stable key for lists. */
  id: string;
  /** The DOM id of the control to focus to fix it. */
  fieldId: string;
  /** The step that holds the control. */
  step: BuilderStep;
  message: string;
}

export type DraftMode = 'preview' | 'publish';

export const FIELD_IDS = {
  photos: 'builder-add-photos',
  visitorName: 'field-visitor-name',
  guideName: 'field-guide-name',
  title: 'field-title',
  closingMessage: 'field-closing-message',
  consent: 'field-consent',
} as const;

export function usablePhotos(photos: readonly DraftPhoto[]): DraftPhoto[] {
  return photos.filter((photo) => photo.processed);
}

export function publishablePhotos(photos: readonly DraftPhoto[]): DraftPhoto[] {
  return photos.filter((photo) => photo.status === 'ready' && photo.photoId !== null);
}

function nameLengthOk(value: string): boolean {
  const length = codePointLength(sanitiseSingleLine(value));
  return length >= LIMITS.nameMinChars && length <= LIMITS.nameMaxChars;
}

/**
 * Lists what stops the draft from being previewed or published (US-8, FR-56, US-22).
 * Previews need a photo and both names; publishing also needs every photo uploaded and the consent.
 */
export function validateDraft(
  input: { fields: DraftFields; photos: readonly DraftPhoto[]; consent: boolean },
  mode: DraftMode,
): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const { fields, photos } = input;

  if (usablePhotos(photos).length < LIMITS.minPhotos) {
    issues.push({
      id: 'photos',
      fieldId: FIELD_IDS.photos,
      step: 1,
      message: 'Add at least one photo.',
    });
  }
  if (!nameLengthOk(fields.visitorName)) {
    issues.push({
      id: 'visitor-name',
      fieldId: FIELD_IDS.visitorName,
      step: 2,
      message: 'Enter the name of the person this museum is for.',
    });
  }
  if (!nameLengthOk(fields.guideName)) {
    issues.push({
      id: 'guide-name',
      fieldId: FIELD_IDS.guideName,
      step: 2,
      message: 'Enter your name, so your guide has a name to wear.',
    });
  }

  if (mode === 'publish') {
    if (photos.some((photo) => photo.status === 'failed')) {
      issues.push({
        id: 'photos-failed',
        fieldId: FIELD_IDS.photos,
        step: 1,
        message: 'A photo did not upload. Retry it or remove it.',
      });
    } else if (photos.some((photo) => photo.status !== 'ready')) {
      issues.push({
        id: 'photos-uploading',
        fieldId: FIELD_IDS.photos,
        step: 1,
        message: 'Your photos are still being prepared. You can publish when they finish.',
      });
    }
    if (!input.consent) {
      issues.push({
        id: 'consent',
        fieldId: FIELD_IDS.consent,
        step: 4,
        message: 'Please confirm you have the right to share these photos.',
      });
    }
  }
  return issues;
}

/** The title the Visitor sees: the Creator's, or "A museum for {name}" when blank (FR-7). */
export function effectiveTitle(title: string, visitorName: string): string {
  const trimmed = title.trim();
  if (trimmed) return trimmed;
  const name = visitorName.trim();
  return name ? `A museum for ${name}` : 'A private view';
}

/** The document sent to `publish`: only photos that are ready on the server, in order. */
export function buildMuseumDocument(
  fields: DraftFields,
  photos: readonly DraftPhoto[],
): MuseumDocument {
  return {
    title: sanitiseSingleLine(fields.title),
    visitorName: sanitiseSingleLine(fields.visitorName),
    guideName: sanitiseSingleLine(fields.guideName),
    openingGreeting: '',
    closingMessage: sanitiseMultiline(fields.closingMessage),
    theme: 'default',
    visitorAvatar: { ...fields.visitorAvatar, facialHair: 'none' },
    guideAvatar: { ...fields.guideAvatar },
    photos: publishablePhotos(photos).map((photo) => ({
      photoId: photo.photoId as string,
      caption: sanitiseMultiline(photo.caption),
    })),
  };
}

/**
 * Builds the same `MuseumContent` a published museum would produce, from local blobs
 * (architecture 5.3), so preview equals published without a server round trip.
 */
export function buildPreviewContent(
  fields: DraftFields,
  photos: readonly DraftPhoto[],
): MuseumContent {
  return {
    title: sanitiseSingleLine(fields.title),
    visitorName: sanitiseSingleLine(fields.visitorName),
    guideName: sanitiseSingleLine(fields.guideName),
    openingGreeting: '',
    closingMessage: sanitiseMultiline(fields.closingMessage),
    theme: 'default',
    visitorAvatar: { ...fields.visitorAvatar, facialHair: 'none' },
    guideAvatar: { ...fields.guideAvatar },
    photos: usablePhotos(photos).map((photo, index) => ({
      id: photo.photoId ?? photo.localId,
      position: index,
      caption: sanitiseMultiline(photo.caption),
      width: photo.width,
      height: photo.height,
      lqip: photo.lqip,
      wallUrl: photo.wallUrl,
      fullUrl: photo.fullUrl,
    })),
  };
}

/** True when leaving the page would lose something worth keeping (memory-only draft, MVP). */
export function hasDraftContent(fields: DraftFields, photos: readonly DraftPhoto[]): boolean {
  return (
    photos.length > 0 ||
    fields.title.trim() !== '' ||
    fields.visitorName.trim() !== '' ||
    fields.guideName.trim() !== '' ||
    fields.closingMessage.trim() !== '' ||
    !avatarsEqual(fields.guideAvatar, DEFAULT_GUIDE_AVATAR) ||
    !avatarsEqual(fields.visitorAvatar, DEFAULT_VISITOR_AVATAR)
  );
}

/** Photo counts used by the review step and the upload summary. */
export function summarisePhotos(photos: readonly DraftPhoto[]) {
  let ready = 0;
  let busy = 0;
  let failed = 0;
  for (const photo of photos) {
    if (photo.status === 'ready') ready += 1;
    else if (photo.status === 'failed') failed += 1;
    else busy += 1;
  }
  return { total: photos.length, ready, busy, failed };
}
