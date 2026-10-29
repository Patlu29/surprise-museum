import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GUIDE_AVATAR } from '@/lib/avatars';
import { useBuilderStore } from './builderStore';
import {
  DRAFT_STORAGE_KEY,
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
});
