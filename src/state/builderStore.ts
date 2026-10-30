import { create } from 'zustand';
import type { AvatarConfig } from '@contract';
import { LIMITS } from '@contract';
import type { AvatarOptionKey, AvatarRole } from '@/lib/avatars';
import { avatarsEqual, DEFAULT_GUIDE_AVATAR, DEFAULT_VISITOR_AVATAR } from '@/lib/avatars';
import { limitText } from '@/lib/text';
import type { BuilderStep, DraftFields, DraftPhoto } from './draft';
import { createInitialFields } from './draft';
import { clearSavedDraft, holdsMoreThanDefaults, loadDraft, saveDraft } from './draftPersistence';

/**
 * The Creator's draft (architecture section 8). The character choices, text fields and step
 * are saved to localStorage and restored on load (US-6 AC-3, US-7); see `draftPersistence.ts`.
 * They are cleared on publish and on Start again. Photos are memory only (full restore with
 * photos is Release 2, US-29). The edit token lives here and is NEVER persisted (FR-50).
 *
 * Read by: the builder UI and the preview screen. The scene does not read it: preview content
 * reaches the scene through `museumStore.setPreview()`.
 */

export interface RejectedFile {
  id: string;
  fileName: string;
  reason: string;
}

export type PublishPhase = 'idle' | 'publishing' | 'failed' | 'done';

export interface PublishState {
  phase: PublishPhase;
  /** Creator-safe message when `phase` is 'failed'. */
  error: string | null;
  shareToken: string | null;
  /** ISO 8601. */
  expiresAt: string | null;
}

export interface BuilderState extends DraftFields {
  /** The step the Creator was last on, so Exit preview returns to the right place. */
  step: BuilderStep;
  /** The furthest step reached. Later steps are not offered by the stepper until reached. */
  maxStep: BuilderStep;
  photos: DraftPhoto[];
  rejections: RejectedFile[];
  consent: boolean;
  /** Set when the first photo is added (`create-museum`). Never persisted. */
  editToken: string | null;
  /** True once the Creator has ticked "I've saved my edit link" on the published screen. */
  editLinkAcknowledged: boolean;
  publish: PublishState;
  /**
   * True while the "Photos aren't kept" notice should show (design spec 5.17): set once at
   * restore time when a draft with content came back without photos. Memory only, never saved.
   */
  restoredDraftNotice: boolean;
  /** True once the notice has been announced, so it is announced once per page load. */
  restoredDraftNoticeAnnounced: boolean;

  setStep: (step: BuilderStep) => void;
  setText: (field: 'title' | 'visitorName' | 'guideName' | 'closingMessage', value: string) => void;
  setAvatarOption: <K extends AvatarOptionKey>(
    role: AvatarRole,
    key: K,
    value: AvatarConfig[K],
  ) => void;
  resetAvatar: (role: AvatarRole) => void;
  setConsent: (value: boolean) => void;

  addPhotoItems: (items: DraftPhoto[]) => void;
  patchPhoto: (localId: string, patch: Partial<DraftPhoto>) => void;
  removePhotoItem: (localId: string) => void;
  movePhoto: (localId: string, toIndex: number) => void;
  setCaption: (localId: string, caption: string) => void;
  addRejections: (items: RejectedFile[]) => void;
  dismissRejections: () => void;

  setEditToken: (token: string | null) => void;
  setPublish: (patch: Partial<PublishState>) => void;
  acknowledgeEditLink: (value: boolean) => void;
  /** Clears the whole draft. Call `discardDraft()` in uploadQueue, which also frees blobs. */
  reset: () => void;
  /** Hides the notice for this page load (Dismiss). Not saved. */
  dismissRestoredDraftNotice: () => void;
  markRestoredDraftNoticeAnnounced: () => void;
}

const TEXT_LIMITS = {
  title: LIMITS.titleMaxChars,
  visitorName: LIMITS.nameMaxChars,
  guideName: LIMITS.nameMaxChars,
  closingMessage: LIMITS.closingMessageMaxChars,
} as const;

const initialPublish: PublishState = {
  phase: 'idle',
  error: null,
  shareToken: null,
  expiresAt: null,
};

function initialState() {
  return {
    ...createInitialFields(),
    step: 1 as BuilderStep,
    maxStep: 1 as BuilderStep,
    photos: [] as DraftPhoto[],
    rejections: [] as RejectedFile[],
    consent: false,
    editToken: null as string | null,
    editLinkAcknowledged: false,
    publish: { ...initialPublish },
    restoredDraftNotice: false,
    restoredDraftNoticeAnnounced: false,
  };
}

/**
 * The state on page load: the saved draft if there is one. Photos are never restored, so a saved
 * draft that holds more than the defaults earns the "Photos aren't kept" notice (design spec 5.17).
 */
export function createRestoredState() {
  const saved = loadDraft();
  return saved
    ? {
        ...initialState(),
        ...saved.fields,
        step: saved.step,
        maxStep: saved.maxStep,
        restoredDraftNotice: holdsMoreThanDefaults(saved),
      }
    : initialState();
}

export const useBuilderStore = create<BuilderState>()((set) => ({
  ...createRestoredState(),

  setStep: (step) =>
    set((state) => ({ step, maxStep: Math.max(state.maxStep, step) as BuilderStep })),

  setText: (field, value) =>
    set({ [field]: limitText(value, TEXT_LIMITS[field]).value } as Pick<
      BuilderState,
      typeof field
    >),

  setAvatarOption: (role, key, value) =>
    set((state) => {
      const target = role === 'guide' ? 'guideAvatar' : 'visitorAvatar';
      return { [target]: { ...state[target], [key]: value } } as Pick<BuilderState, typeof target>;
    }),

  resetAvatar: (role) =>
    set(
      role === 'guide'
        ? { guideAvatar: { ...DEFAULT_GUIDE_AVATAR } }
        : { visitorAvatar: { ...DEFAULT_VISITOR_AVATAR } },
    ),

  setConsent: (consent) => set({ consent }),

  addPhotoItems: (items) =>
    set((state) => ({
      photos: [...state.photos, ...items],
      // The notice goes the moment a photo row is created (design spec 5.17).
      restoredDraftNotice: items.length > 0 ? false : state.restoredDraftNotice,
    })),

  patchPhoto: (localId, patch) =>
    set((state) => ({
      photos: state.photos.map((photo) =>
        photo.localId === localId ? { ...photo, ...patch } : photo,
      ),
    })),

  removePhotoItem: (localId) =>
    set((state) => ({ photos: state.photos.filter((photo) => photo.localId !== localId) })),

  movePhoto: (localId, toIndex) =>
    set((state) => {
      const from = state.photos.findIndex((photo) => photo.localId === localId);
      if (from < 0) return state;
      const target = Math.max(0, Math.min(state.photos.length - 1, toIndex));
      if (target === from) return state;
      const next = state.photos.slice();
      const [moved] = next.splice(from, 1);
      if (!moved) return state;
      next.splice(target, 0, moved);
      return { photos: next };
    }),

  setCaption: (localId, caption) =>
    set((state) => ({
      photos: state.photos.map((photo) =>
        photo.localId === localId
          ? { ...photo, caption: limitText(caption, LIMITS.captionMaxChars).value }
          : photo,
      ),
    })),

  addRejections: (items) => set((state) => ({ rejections: [...state.rejections, ...items] })),
  dismissRejections: () => set({ rejections: [] }),

  setEditToken: (editToken) => set({ editToken }),
  setPublish: (patch) =>
    set((state) => ({
      publish: { ...state.publish, ...patch },
      restoredDraftNotice: patch.phase === 'done' ? false : state.restoredDraftNotice,
    })),
  acknowledgeEditLink: (editLinkAcknowledged) => set({ editLinkAcknowledged }),

  reset: () => {
    clearSavedDraft();
    set(initialState());
  },

  dismissRestoredDraftNotice: () => set({ restoredDraftNotice: false }),
  markRestoredDraftNoticeAnnounced: () => set({ restoredDraftNoticeAnnounced: true }),
}));

function isBlank(state: BuilderState): boolean {
  const blank = createInitialFields();
  return (
    state.step === 1 &&
    state.title === blank.title &&
    state.visitorName === blank.visitorName &&
    state.guideName === blank.guideName &&
    state.closingMessage === blank.closingMessage &&
    avatarsEqual(state.guideAvatar, blank.guideAvatar) &&
    avatarsEqual(state.visitorAvatar, blank.visitorAvatar)
  );
}

// Save on every change to a persisted field. A published or blank draft is removed instead, so
// Start again and a finished museum leave nothing behind.
useBuilderStore.subscribe((state, previous) => {
  const changed =
    state.title !== previous.title ||
    state.visitorName !== previous.visitorName ||
    state.guideName !== previous.guideName ||
    state.closingMessage !== previous.closingMessage ||
    state.guideAvatar !== previous.guideAvatar ||
    state.visitorAvatar !== previous.visitorAvatar ||
    state.step !== previous.step ||
    state.maxStep !== previous.maxStep ||
    state.publish.phase !== previous.publish.phase;
  if (!changed) return;
  if (state.publish.phase === 'done' || isBlank(state)) {
    clearSavedDraft();
    return;
  }
  saveDraft({
    fields: {
      title: state.title,
      visitorName: state.visitorName,
      guideName: state.guideName,
      closingMessage: state.closingMessage,
      guideAvatar: state.guideAvatar,
      visitorAvatar: state.visitorAvatar,
    },
    step: state.step,
    maxStep: state.maxStep,
  });
});

/** A blank photo row, for the upload queue. */
export function createDraftPhoto(localId: string, fileName: string, caption = ''): DraftPhoto {
  return {
    localId,
    photoId: null,
    fileName,
    status: 'queued',
    progress: 0,
    error: null,
    errorKind: null,
    caption,
    width: 0,
    height: 0,
    lqip: '',
    wallUrl: '',
    fullUrl: '',
    processed: false,
  };
}
