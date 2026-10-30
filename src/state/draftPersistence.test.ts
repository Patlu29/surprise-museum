import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GUIDE_AVATAR, DEFAULT_VISITOR_AVATAR } from '@/lib/avatars';
import { createDraftPhoto, createRestoredState, useBuilderStore } from './builderStore';
import {
  DRAFT_STORAGE_KEY,
  holdsMoreThanDefaults,
  loadDraft,
  parsePersistedDraft,
  saveDraft,
  serialiseDraft,
} from './draftPersistence';
import { createInitialFields } from './draft';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('draft persistence', () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    useBuilderStore.getState().reset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips fields, avatars and step', () => {
    const fields = {
      ...createInitialFields(),
      title: 'Our year',
      guideName: 'Sam',
      guideAvatar: { ...DEFAULT_GUIDE_AVATAR, hairStyle: 'long' as never },
    };
    saveDraft({ fields, step: 3, maxStep: 3 });
    const loaded = loadDraft();
    expect(loaded?.fields.title).toBe('Our year');
    expect(loaded?.fields.guideName).toBe('Sam');
    expect(loaded?.step).toBe(3);
  });

  it('saves store changes and never stores photos or the edit token', () => {
    const store = useBuilderStore.getState();
    store.setText('visitorName', 'Alex');
    store.setEditToken('secret-token');
    store.setStep(2);
    const raw = storage.data.get(DRAFT_STORAGE_KEY) ?? '';
    expect(JSON.parse(raw).fields.visitorName).toBe('Alex');
    expect(raw).not.toContain('secret-token');
    expect(raw).not.toContain('photos');
  });

  it('clears on reset (Start again) and on publish', () => {
    const store = useBuilderStore.getState();
    store.setText('title', 'Hello');
    expect(storage.data.has(DRAFT_STORAGE_KEY)).toBe(true);
    store.reset();
    expect(storage.data.has(DRAFT_STORAGE_KEY)).toBe(false);
    store.setText('title', 'Hello');
    store.setPublish({ phase: 'done', shareToken: 'x' });
    expect(storage.data.has(DRAFT_STORAGE_KEY)).toBe(false);
  });

  it('ignores corrupt, old-version and malformed data', () => {
    expect(parsePersistedDraft('{not json')).toBeNull();
    expect(parsePersistedDraft(null)).toBeNull();
    expect(parsePersistedDraft('[]')).toBeNull();
    expect(parsePersistedDraft(JSON.stringify({ version: 0, fields: {} }))).toBeNull();
    expect(parsePersistedDraft(JSON.stringify({ version: 1 }))).toBeNull();
  });

  it('drops unknown option ids and wrong types, keeping the rest', () => {
    const raw = JSON.stringify({
      version: 1,
      step: 9,
      fields: {
        title: 42,
        guideName: 'Sam',
        guideAvatar: { hairStyle: 'nonsense', skinTone: DEFAULT_GUIDE_AVATAR.skinTone },
      },
    });
    const draft = parsePersistedDraft(raw);
    expect(draft?.fields.title).toBe('');
    expect(draft?.fields.guideName).toBe('Sam');
    expect(draft?.fields.guideAvatar.hairStyle).toBe(DEFAULT_GUIDE_AVATAR.hairStyle);
    expect(draft?.step).toBe(1);
  });

  it('does not throw when storage is unavailable or full', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadDraft()).toBeNull();
    expect(() => saveDraft({ fields: createInitialFields(), step: 1, maxStep: 1 })).not.toThrow();
    expect(() => useBuilderStore.getState().setText('title', 'x')).not.toThrow();
    expect(() => useBuilderStore.getState().reset()).not.toThrow();
  });

  it('serialises with a version', () => {
    const raw = serialiseDraft({ fields: createInitialFields(), step: 1, maxStep: 1 });
    expect(JSON.parse(raw).version).toBe(1);
  });

  describe('gender (ADR 0020)', () => {
    const legacyAvatar = (() => {
      const { gender: _ignored, ...rest } = DEFAULT_GUIDE_AVATAR;
      return { ...rest, hairStyle: 'afro', outfitColor: 'teal' };
    })();

    it('restores an old draft with no gender as Neutral and keeps every other choice', () => {
      const raw = JSON.stringify({
        version: 1,
        step: 3,
        maxStep: 3,
        fields: { guideName: 'Sam', guideAvatar: legacyAvatar, visitorAvatar: legacyAvatar },
      });
      const draft = parsePersistedDraft(raw);
      expect(draft?.fields.guideAvatar.gender).toBe('neutral');
      expect(draft?.fields.visitorAvatar.gender).toBe('neutral');
      expect(draft?.fields.guideAvatar.hairStyle).toBe('afro');
      expect(draft?.fields.guideAvatar.outfitColor).toBe('teal');
      expect(draft?.step).toBe(3);
    });

    it('keeps a valid gender and ignores an unknown one', () => {
      const raw = JSON.stringify({
        version: 1,
        fields: {
          guideAvatar: { ...legacyAvatar, gender: 'feminine' },
          visitorAvatar: { ...legacyAvatar, gender: 'Woman' },
        },
      });
      const draft = parsePersistedDraft(raw);
      expect(draft?.fields.guideAvatar.gender).toBe('feminine');
      expect(draft?.fields.visitorAvatar.gender).toBe('neutral');
      for (const bad of [null, 1, '', 'female']) {
        const next = parsePersistedDraft(
          JSON.stringify({ version: 1, fields: { guideAvatar: { gender: bad } } }),
        );
        expect(next?.fields.guideAvatar.gender).toBe('neutral');
      }
    });

    it('round-trips gender and Visitor facial hair, with the key and version unchanged', () => {
      expect(DRAFT_STORAGE_KEY).toBe('surprise-museum:draft:v1');
      const fields = {
        ...createInitialFields(),
        guideAvatar: { ...DEFAULT_GUIDE_AVATAR, gender: 'masculine' as const },
        visitorAvatar: {
          ...DEFAULT_VISITOR_AVATAR,
          gender: 'feminine' as const,
          facialHair: 'goatee' as const,
        },
      };
      saveDraft({ fields, step: 3, maxStep: 3 });
      const loaded = loadDraft();
      expect(loaded?.fields.guideAvatar.gender).toBe('masculine');
      expect(loaded?.fields.visitorAvatar.gender).toBe('feminine');
      expect(loaded?.fields.visitorAvatar.facialHair).toBe('goatee');
      expect(JSON.parse(serialiseDraft({ fields, step: 3, maxStep: 3 })).version).toBe(1);
    });

    it('saves a gender change from the store', () => {
      useBuilderStore.getState().setAvatarOption('visitor', 'gender', 'masculine');
      const raw = JSON.parse(storage.data.get(DRAFT_STORAGE_KEY) ?? '{}');
      expect(raw.fields.visitorAvatar.gender).toBe('masculine');
    });
  });

  describe('restored-draft notice (design spec 5.17)', () => {
    const stored = (fields: Record<string, unknown>, step = 1) =>
      storage.data.set(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ version: 1, step, maxStep: step, fields }),
      );

    it('shows for a restored draft with content and no photos', () => {
      stored({ guideName: 'Sam' });
      const state = createRestoredState();
      expect(state.restoredDraftNotice).toBe(true);
      expect(state.photos).toEqual([]);
      expect(state.guideName).toBe('Sam');
    });

    it.each([
      ['a name', { visitorName: 'Alex' }, 1],
      ['text', { closingMessage: 'Hi' }, 1],
      ['a non-default character choice', { guideAvatar: { hairStyle: 'afro' } }, 1],
      ['a non-default gender', { visitorAvatar: { gender: 'masculine' } }, 1],
      ['a step later than 1', {}, 2],
    ])('counts %s as more than the defaults', (_name, fields, step) => {
      stored(fields, step);
      expect(createRestoredState().restoredDraftNotice).toBe(true);
    });

    it('shows nothing for a defaults-only stored draft', () => {
      stored({
        title: '',
        guideAvatar: { ...DEFAULT_GUIDE_AVATAR },
        visitorAvatar: { ...DEFAULT_VISITOR_AVATAR, gender: 'neutral' },
      });
      expect(createRestoredState().restoredDraftNotice).toBe(false);
      // An old draft with no gender equals the defaults too.
      const { gender: _ignored, ...legacy } = DEFAULT_GUIDE_AVATAR;
      stored({ guideAvatar: legacy });
      expect(createRestoredState().restoredDraftNotice).toBe(false);
      expect(
        holdsMoreThanDefaults(parsePersistedDraft(storage.data.get(DRAFT_STORAGE_KEY) ?? '')!),
      ).toBe(false);
    });

    it('shows nothing when there is no stored draft, or it cannot be trusted', () => {
      expect(createRestoredState().restoredDraftNotice).toBe(false);
      storage.data.set(DRAFT_STORAGE_KEY, '{not json');
      expect(createRestoredState().restoredDraftNotice).toBe(false);
    });

    it('is not shown for a draft started in this page load', () => {
      useBuilderStore.getState().setText('guideName', 'Sam');
      expect(useBuilderStore.getState().restoredDraftNotice).toBe(false);
    });

    it('goes when a photo row is created, on dismiss, on publish and on a new draft', () => {
      const store = () => useBuilderStore.getState();
      const row = (id: string) => createDraftPhoto(id, `${id}.jpg`);

      useBuilderStore.setState({ restoredDraftNotice: true });
      store().addPhotoItems([]);
      expect(store().restoredDraftNotice).toBe(true); // nothing added, nothing removed
      store().addPhotoItems([row('a')]);
      expect(store().restoredDraftNotice).toBe(false);

      useBuilderStore.setState({ restoredDraftNotice: true });
      store().dismissRestoredDraftNotice();
      expect(store().restoredDraftNotice).toBe(false);

      useBuilderStore.setState({ restoredDraftNotice: true });
      store().setPublish({ phase: 'publishing' });
      expect(store().restoredDraftNotice).toBe(true);
      store().setPublish({ phase: 'done' });
      expect(store().restoredDraftNotice).toBe(false);

      useBuilderStore.setState({ restoredDraftNotice: true });
      store().reset();
      expect(store().restoredDraftNotice).toBe(false);
    });

    it('does not come back when the Creator removes every photo, and is never stored', () => {
      const store = () => useBuilderStore.getState();
      useBuilderStore.setState({ restoredDraftNotice: true });
      store().addPhotoItems([createDraftPhoto('a', 'a.jpg')]);
      store().removePhotoItem('a');
      expect(store().restoredDraftNotice).toBe(false);
      store().setText('title', 'Hello');
      expect(storage.data.get(DRAFT_STORAGE_KEY)).not.toContain('restoredDraftNotice');
    });

    it('records that the announcement was made, once', () => {
      useBuilderStore.setState({ restoredDraftNotice: true });
      expect(useBuilderStore.getState().restoredDraftNoticeAnnounced).toBe(false);
      useBuilderStore.getState().markRestoredDraftNoticeAnnounced();
      expect(useBuilderStore.getState().restoredDraftNoticeAnnounced).toBe(true);
    });
  });
});
