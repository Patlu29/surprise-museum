import { beforeEach, describe, expect, it } from 'vitest';
import { ApiRequestError, setApi, type MuseumApi } from '@/lib/apiPort';
import { createDraftPhoto, useBuilderStore } from './builderStore';
import { MSG_PUBLISH_FAILED, publishDraft } from './publish';

function seedReadyDraft() {
  const store = useBuilderStore.getState();
  store.reset();
  store.setText('visitorName', 'Sophie');
  store.setText('guideName', 'Tom');
  store.setEditToken('E'.repeat(43));
  store.setConsent(true);
  store.addPhotoItems([
    {
      ...createDraftPhoto('a', 'a.jpg', 'Hello'),
      photoId: 'server-a',
      status: 'ready',
      processed: true,
      width: 10,
      height: 10,
    },
  ]);
}

function apiWith(publish: MuseumApi['publish']): MuseumApi {
  const unused = () => Promise.reject(new Error('unused'));
  return {
    createMuseum: unused,
    getMuseum: unused,
    manageGet: unused,
    reservePhoto: unused,
    renewUpload: unused,
    confirmPhoto: unused,
    removePhoto: unused,
    publish,
    deleteMuseum: unused,
    uploadPhotoFile: unused,
  };
}

describe('publishDraft', () => {
  beforeEach(seedReadyDraft);

  it('publishes the document and keeps the share token and edit token in memory', async () => {
    let sent: unknown;
    setApi(
      apiWith(async (_token, document) => {
        sent = document;
        return {
          shareToken: 'abcdefghijklmnopqrstuvwx',
          publishedAt: '',
          expiresAt: '2027-01-01T00:00:00Z',
        };
      }),
    );
    expect(await publishDraft()).toBe(true);
    const { publish } = useBuilderStore.getState();
    expect(publish).toMatchObject({ phase: 'done', shareToken: 'abcdefghijklmnopqrstuvwx' });
    expect(sent).toMatchObject({
      visitorName: 'Sophie',
      guideName: 'Tom',
      photos: [{ photoId: 'server-a', caption: 'Hello' }],
    });
  });

  it('cannot run twice at once (US-22)', async () => {
    let calls = 0;
    let release: () => void = () => undefined;
    setApi(
      apiWith(
        () =>
          new Promise((resolve) => {
            calls += 1;
            release = () =>
              resolve({ shareToken: 'abcdefghijklmnopqrstuvwx', publishedAt: '', expiresAt: '' });
          }),
      ),
    );
    const first = publishDraft();
    expect(await publishDraft()).toBe(false);
    release();
    await first;
    expect(calls).toBe(1);
  });

  it('keeps all work and explains a failure, and allows another try', async () => {
    setApi(
      apiWith(async () => {
        throw new ApiRequestError('network', 'offline');
      }),
    );
    expect(await publishDraft()).toBe(false);
    const state = useBuilderStore.getState();
    expect(state.publish).toMatchObject({ phase: 'failed', error: MSG_PUBLISH_FAILED });
    expect(state.photos).toHaveLength(1);
    expect(state.visitorName).toBe('Sophie');

    setApi(
      apiWith(async () => ({
        shareToken: 'abcdefghijklmnopqrstuvwx',
        publishedAt: '',
        expiresAt: '',
      })),
    );
    expect(await publishDraft()).toBe(true);
  });

  it('adds the wait-a-few-minutes advice for a rate limit', async () => {
    setApi(
      apiWith(async () => {
        throw new ApiRequestError('rate_limited', 'slow down', { status: 429 });
      }),
    );
    await publishDraft();
    expect(useBuilderStore.getState().publish.error).toContain('wait a few minutes');
  });

  it('does not publish without the consent (FR-56)', async () => {
    useBuilderStore.getState().setConsent(false);
    setApi(apiWith(async () => ({ shareToken: 'x', publishedAt: '', expiresAt: '' })));
    expect(await publishDraft()).toBe(false);
    expect(useBuilderStore.getState().publish.phase).toBe('idle');
  });
});
