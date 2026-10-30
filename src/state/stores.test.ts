import { beforeEach, describe, expect, it } from 'vitest';
import { LIMITS } from '@contract';
import { ApiRequestError, setApi, type MuseumApi } from '@/lib/apiPort';
import { DEFAULT_GUIDE_AVATAR } from '@/lib/avatars';
import { announce, useAnnouncerStore } from './announcer';
import { createDraftPhoto, useBuilderStore } from './builderStore';
import {
  addOrbitDelta,
  addZoomDelta,
  clearInput,
  consumeOrbitDelta,
  consumeZoomDelta,
  inputState,
  setMoveSource,
  setOrbitRate,
} from './inputState';
import { useMuseumStore } from './museumStore';
import { clearScreenRects, publishScreenRects, screenRects } from './screenRects';
import { useSessionStore } from './sessionStore';
import { DEFAULT_SETTINGS, resolveReducedMotion, useSettingsStore } from './settingsStore';

describe('settingsStore', () => {
  beforeEach(() => useSettingsStore.setState({ ...DEFAULT_SETTINGS }));

  it('starts with the design defaults', () => {
    const state = useSettingsStore.getState();
    expect(state.motion).toBe('system');
    expect(state.captionSize).toBe('normal');
    expect(state.controls).toBe('auto');
    expect(state.quality).toBe('auto');
  });

  it('applies changes straight away', () => {
    useSettingsStore.getState().setCaptionSize('xlarge');
    useSettingsStore.getState().setMotion('reduce');
    expect(useSettingsStore.getState().captionSize).toBe('xlarge');
    expect(useSettingsStore.getState().motion).toBe('reduce');
  });

  it('resolves reduced motion from the setting and the operating system', () => {
    expect(resolveReducedMotion('system', true)).toBe(true);
    expect(resolveReducedMotion('system', false)).toBe(false);
    expect(resolveReducedMotion('reduce', false)).toBe(true);
    expect(resolveReducedMotion('full', true)).toBe(false);
  });
});

describe('builderStore', () => {
  beforeEach(() => useBuilderStore.getState().reset());

  it('limits text by Unicode code points, not UTF-16 units', () => {
    const { setText } = useBuilderStore.getState();
    setText('visitorName', '😀'.repeat(30));
    expect([...useBuilderStore.getState().visitorName]).toHaveLength(LIMITS.nameMaxChars);
    setText('closingMessage', 'a'.repeat(1200));
    expect(useBuilderStore.getState().closingMessage).toHaveLength(LIMITS.closingMessageMaxChars);
    setText('title', 'x'.repeat(100));
    expect(useBuilderStore.getState().title).toHaveLength(LIMITS.titleMaxChars);
  });

  it('limits captions to 280 characters', () => {
    useBuilderStore.getState().addPhotoItems([createDraftPhoto('a', 'a.jpg')]);
    useBuilderStore.getState().setCaption('a', 'é'.repeat(300));
    expect([...(useBuilderStore.getState().photos[0]?.caption ?? '')]).toHaveLength(
      LIMITS.captionMaxChars,
    );
  });

  it('reorders photos and clamps the target', () => {
    const store = useBuilderStore.getState();
    store.addPhotoItems(['a', 'b', 'c', 'd'].map((id) => createDraftPhoto(id, `${id}.jpg`)));
    store.movePhoto('d', 0);
    expect(useBuilderStore.getState().photos.map((p) => p.localId)).toEqual(['d', 'a', 'b', 'c']);
    store.movePhoto('d', 99);
    expect(useBuilderStore.getState().photos.map((p) => p.localId)).toEqual(['a', 'b', 'c', 'd']);
    store.movePhoto('missing', 1);
    expect(useBuilderStore.getState().photos).toHaveLength(4);
  });

  it('removes a photo and keeps the rest in order', () => {
    const store = useBuilderStore.getState();
    store.addPhotoItems(['a', 'b', 'c'].map((id) => createDraftPhoto(id, `${id}.jpg`)));
    store.removePhotoItem('b');
    expect(useBuilderStore.getState().photos.map((p) => p.localId)).toEqual(['a', 'c']);
  });

  it('changes one avatar option at a time and resets to the defaults', () => {
    const store = useBuilderStore.getState();
    store.setAvatarOption('guide', 'hairStyle', 'afro');
    expect(useBuilderStore.getState().guideAvatar.hairStyle).toBe('afro');
    expect(useBuilderStore.getState().guideAvatar.skinTone).toBe(DEFAULT_GUIDE_AVATAR.skinTone);
    store.resetAvatar('guide');
    expect(useBuilderStore.getState().guideAvatar).toEqual(DEFAULT_GUIDE_AVATAR);
  });

  it('offers facial hair to both characters (CR-1)', () => {
    useBuilderStore.getState().setAvatarOption('visitor', 'facialHair', 'goatee');
    expect(useBuilderStore.getState().visitorAvatar.facialHair).toBe('goatee');
    useBuilderStore.getState().setAvatarOption('guide', 'facialHair', 'full-beard');
    expect(useBuilderStore.getState().guideAvatar.facialHair).toBe('full-beard');
  });

  it('sets gender per character and keeps every other option (CR-1)', () => {
    const store = useBuilderStore.getState();
    expect(useBuilderStore.getState().guideAvatar.gender).toBe('neutral');
    store.setAvatarOption('guide', 'hairStyle', 'afro');
    store.setAvatarOption('guide', 'gender', 'feminine');
    store.setAvatarOption('visitor', 'gender', 'masculine');
    const { guideAvatar, visitorAvatar } = useBuilderStore.getState();
    expect(guideAvatar.gender).toBe('feminine');
    expect(guideAvatar.hairStyle).toBe('afro');
    expect(visitorAvatar.gender).toBe('masculine');
    store.resetAvatar('guide');
    expect(useBuilderStore.getState().guideAvatar.gender).toBe('neutral');
    expect(useBuilderStore.getState().visitorAvatar.gender).toBe('masculine');
  });

  it('remembers the furthest step reached', () => {
    useBuilderStore.getState().setStep(3);
    useBuilderStore.getState().setStep(2);
    expect(useBuilderStore.getState().step).toBe(2);
    expect(useBuilderStore.getState().maxStep).toBe(3);
  });

  it('collects and dismisses rejected files', () => {
    useBuilderStore
      .getState()
      .addRejections([{ id: '1', fileName: 'a.pdf', reason: 'Not a photo' }]);
    expect(useBuilderStore.getState().rejections).toHaveLength(1);
    useBuilderStore.getState().dismissRejections();
    expect(useBuilderStore.getState().rejections).toHaveLength(0);
  });

  it('clears everything on reset, including the edit token', () => {
    const store = useBuilderStore.getState();
    store.setEditToken('secret');
    store.setText('guideName', 'Tom');
    store.reset();
    expect(useBuilderStore.getState().editToken).toBeNull();
    expect(useBuilderStore.getState().guideName).toBe('');
  });
});

describe('sessionStore', () => {
  beforeEach(() => useSessionStore.getState().reset());

  it('marks a photo viewed when its presentation starts (A-17)', () => {
    useSessionStore.getState().setPresentation({ kind: 'photo', photoId: 'p1' });
    expect([...useSessionStore.getState().viewed]).toEqual(['p1']);
    useSessionStore.getState().setPresentation({ kind: 'finale' });
    expect(useSessionStore.getState().viewed.size).toBe(1);
  });

  it('ignores a repeated presentation so nothing re-renders', () => {
    useSessionStore.getState().setPresentation({ kind: 'photo', photoId: 'p1' });
    const before = useSessionStore.getState();
    useSessionStore.getState().setPresentation({ kind: 'photo', photoId: 'p1' });
    expect(useSessionStore.getState()).toBe(before);
  });

  it('marks a photo viewed when opened full-screen, and closes', () => {
    useSessionStore.getState().openViewer('p2');
    expect(useSessionStore.getState().viewerPhotoId).toBe('p2');
    expect(useSessionStore.getState().viewed.has('p2')).toBe(true);
    useSessionStore.getState().closeViewer();
    expect(useSessionStore.getState().viewerPhotoId).toBeNull();
    expect(useSessionStore.getState().viewed.has('p2')).toBe(true);
  });

  it('dismissing ends the presentation and bumps the command counter', () => {
    useSessionStore.getState().setPresentation({ kind: 'photo', photoId: 'p1' });
    const seq = useSessionStore.getState().dismissSeq;
    useSessionStore.getState().dismissPresentation();
    expect(useSessionStore.getState().dismissSeq).toBe(seq + 1);
    expect(useSessionStore.getState().presentation).toEqual({ kind: 'none' });
    expect(useSessionStore.getState().viewed.has('p1')).toBe(true);
  });

  it('replay clears the viewed count and bumps its counter', () => {
    useSessionStore.getState().markViewed('p1');
    useSessionStore.getState().replay();
    expect(useSessionStore.getState().viewed.size).toBe(0);
    expect(useSessionStore.getState().replaySeq).toBe(1);
  });

  it('numbers jump requests so the scene can react to each one', () => {
    useSessionStore.getState().requestJump({ kind: 'photo', photoId: 'p3' });
    useSessionStore.getState().requestJump({ kind: 'finale' });
    expect(useSessionStore.getState().jump).toEqual({ target: { kind: 'finale' }, seq: 2 });
  });

  it('lets the scene subscribe to one field with a selector', () => {
    const seen: number[] = [];
    const unsubscribe = useSessionStore.subscribe(
      (state) => state.resetViewSeq,
      (seq) => seen.push(seq),
    );
    useSessionStore.getState().resetView();
    useSessionStore.getState().resetView();
    useSessionStore.getState().setSceneReady(true);
    unsubscribe();
    expect(seen).toEqual([1, 2]);
  });

  it('clamps scene progress and ignores a repeated area', () => {
    useSessionStore.getState().setSceneProgress(1.7);
    expect(useSessionStore.getState().sceneProgress).toBe(1);
    useSessionStore.getState().setArea({ kind: 'gallery', index: 1, count: 3 });
    const before = useSessionStore.getState();
    useSessionStore.getState().setArea({ kind: 'gallery', index: 1, count: 3 });
    expect(useSessionStore.getState()).toBe(before);
  });

  it('tracks the finale with finaleReached, and clears it on dismiss, replay and jump', () => {
    useSessionStore.getState().setFinaleReached(true);
    expect(useSessionStore.getState().finaleReached).toBe(true);
    useSessionStore.getState().dismissPresentation();
    expect(useSessionStore.getState().finaleReached).toBe(false);

    useSessionStore.getState().setFinaleReached(true);
    useSessionStore.getState().replay();
    expect(useSessionStore.getState().finaleReached).toBe(false);

    useSessionStore.getState().setFinaleReached(true);
    useSessionStore.getState().requestJump({ kind: 'photo', photoId: 'p1' });
    expect(useSessionStore.getState().finaleReached).toBe(false);

    useSessionStore.getState().setFinaleReached(true);
    useSessionStore.getState().reset();
    expect(useSessionStore.getState().finaleReached).toBe(false);
  });

  it('starts in the welcome phase and returns there on reset', () => {
    expect(useSessionStore.getState().phase).toBe('welcome');
    useSessionStore.getState().start();
    expect(useSessionStore.getState().phase).toBe('roaming');
    useSessionStore.getState().reset();
    expect(useSessionStore.getState().phase).toBe('welcome');
  });
});

const shareToken = 'abcdefghijklmnopqrstuvwx';

function fakeMuseum() {
  return {
    title: '',
    visitorName: 'Sophie',
    guideName: 'Tom',
    openingGreeting: '',
    closingMessage: '',
    theme: 'default' as const,
    visitorAvatar: { ...DEFAULT_GUIDE_AVATAR },
    guideAvatar: { ...DEFAULT_GUIDE_AVATAR },
    photos: [
      {
        id: 'p1',
        position: 0,
        caption: 'One',
        width: 10,
        height: 10,
        lqip: '',
        wallUrl: 'w1',
        fullUrl: 'f1',
      },
      {
        id: 'p2',
        position: 1,
        caption: '',
        width: 10,
        height: 10,
        lqip: '',
        wallUrl: 'w2',
        fullUrl: 'f2',
      },
    ],
  };
}

function apiWith(getMuseum: MuseumApi['getMuseum']): MuseumApi {
  const unused = () => Promise.reject(new Error('not used'));
  return {
    createMuseum: unused,
    getMuseum,
    manageGet: unused,
    reservePhoto: unused,
    renewUpload: unused,
    confirmPhoto: unused,
    removePhoto: unused,
    publish: unused,
    deleteMuseum: unused,
    uploadPhotoFile: unused,
  };
}

describe('museumStore', () => {
  beforeEach(() => {
    useMuseumStore.getState().clear();
  });

  it('loads a published museum and starts every photo at the placeholder', async () => {
    setApi(apiWith(async () => ({ museum: fakeMuseum(), urlsExpireAt: '2026-01-01T00:00:00Z' })));
    await useMuseumStore.getState().loadPublished(shareToken);
    const state = useMuseumStore.getState();
    expect(state.status).toBe('ready');
    expect(state.source).toBe('published');
    expect(state.content?.photos).toHaveLength(2);
    expect(state.photoStatus).toEqual({ p1: 'placeholder', p2: 'placeholder' });
  });

  it('shows not found for an unknown link, without revealing anything', async () => {
    setApi(
      apiWith(async () => {
        throw new ApiRequestError('not_found', 'x', { status: 404 });
      }),
    );
    await useMuseumStore.getState().loadPublished(shareToken);
    expect(useMuseumStore.getState().status).toBe('not-found');
    expect(useMuseumStore.getState().content).toBeNull();
  });

  it('does not call the network for a malformed token', async () => {
    let calls = 0;
    setApi(
      apiWith(async () => {
        calls += 1;
        return { museum: fakeMuseum(), urlsExpireAt: '' };
      }),
    );
    await useMuseumStore.getState().loadPublished('nope');
    expect(useMuseumStore.getState().status).toBe('not-found');
    expect(calls).toBe(0);
  });

  it('reports a dropped connection as an error that can be retried', async () => {
    let fail = true;
    setApi(
      apiWith(async () => {
        if (fail) throw new ApiRequestError('network', 'offline');
        return { museum: fakeMuseum(), urlsExpireAt: '' };
      }),
    );
    await useMuseumStore.getState().loadPublished(shareToken);
    expect(useMuseumStore.getState().status).toBe('error');
    expect(useMuseumStore.getState().errorCode).toBe('network');
    fail = false;
    await useMuseumStore.getState().loadPublished(shareToken);
    expect(useMuseumStore.getState().status).toBe('ready');
  });

  it('holds a preview and tracks photo status and retries', () => {
    useMuseumStore.getState().setPreview(fakeMuseum());
    expect(useMuseumStore.getState().source).toBe('preview');
    useMuseumStore.getState().setPhotoStatus('p1', 'failed');
    expect(useMuseumStore.getState().photoStatus.p1).toBe('failed');
    useMuseumStore.getState().requestPhotoRetry('p1');
    expect(useMuseumStore.getState().retryRequest).toEqual({ photoId: 'p1', seq: 1 });
    expect(useMuseumStore.getState().photoStatus.p1).toBe('loading');
  });

  it('refreshes signed URLs without changing photo ids or order', async () => {
    let round = 0;
    setApi(
      apiWith(async () => {
        round += 1;
        const museum = fakeMuseum();
        if (round > 1)
          museum.photos = museum.photos.map((p) => ({ ...p, wallUrl: `new-${p.wallUrl}` }));
        return { museum, urlsExpireAt: `t${round}` };
      }),
    );
    await useMuseumStore.getState().loadPublished(shareToken);
    expect(await useMuseumStore.getState().refreshUrls()).toBe(true);
    const state = useMuseumStore.getState();
    expect(state.content?.photos.map((p) => [p.id, p.wallUrl])).toEqual([
      ['p1', 'new-w1'],
      ['p2', 'new-w2'],
    ]);
    expect(state.urlsExpireAt).toBe('t2');
  });
});

describe('inputState', () => {
  beforeEach(() => clearInput());

  it('merges sources and keeps the length at 1 or less', () => {
    setMoveSource('keyboard', 0, 1);
    setMoveSource('joystick', 1, 0);
    expect(Math.hypot(inputState.move.x, inputState.move.y)).toBeCloseTo(1, 5);
    setMoveSource('keyboard', 0, 0);
    expect(inputState.move).toEqual({ x: 1, y: 0 });
  });

  it('clamps each source to -1..1', () => {
    setMoveSource('arrows', 5, -5);
    expect(inputState.move.x).toBeLessThanOrEqual(1);
    expect(inputState.move.y).toBeGreaterThanOrEqual(-1);
  });

  it('adds turn rates from keys and buttons', () => {
    setOrbitRate('keyboard', 90, 0);
    setOrbitRate('buttons', 90, 10);
    expect(inputState.orbitRate).toEqual({ yaw: 180, pitch: 10 });
  });

  it('accumulates drag and zoom until consumed', () => {
    addOrbitDelta(3, 1);
    addOrbitDelta(2, -4);
    expect(consumeOrbitDelta()).toEqual({ yaw: 5, pitch: -3 });
    expect(consumeOrbitDelta()).toEqual({ yaw: 0, pitch: 0 });
    addZoomDelta(0.4);
    addZoomDelta(0.4);
    expect(consumeZoomDelta()).toBeCloseTo(0.8);
    expect(consumeZoomDelta()).toBe(0);
  });

  it('stops everything at once', () => {
    setMoveSource('joystick', 1, 1);
    setOrbitRate('keyboard', 90, 60);
    addOrbitDelta(5, 5);
    clearInput();
    expect(inputState.move).toEqual({ x: 0, y: 0 });
    expect(inputState.orbitRate).toEqual({ yaw: 0, pitch: 0 });
    expect(inputState.orbitDelta).toEqual({ yaw: 0, pitch: 0 });
  });
});

describe('screenRects and announcer', () => {
  it('publishes rectangles with a timestamp and clears them', () => {
    publishScreenRects({ picture: { x: 1, y: 2, width: 3, height: 4 }, visitor: null });
    expect(screenRects.picture).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(screenRects.updatedAt).toBeGreaterThan(0);
    clearScreenRects();
    expect(screenRects.picture).toBeNull();
    expect(screenRects.updatedAt).toBe(0);
  });

  it('changes the sequence on every announcement, even for the same text', () => {
    announce('Hello');
    const first = useAnnouncerStore.getState().seq;
    announce('Hello');
    expect(useAnnouncerStore.getState().seq).toBe(first + 1);
    expect(useAnnouncerStore.getState().message).toBe('Hello');
  });
});
