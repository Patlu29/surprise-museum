import { getApi, isApiError } from '@/lib/apiPort';
import { useBuilderStore } from './builderStore';
import { buildMuseumDocument, validateDraft } from './draft';

export const MSG_PUBLISH_FAILED =
  "We couldn't publish your museum. Your photos and words are safe.";

/**
 * Publishes the draft (FR-47, FR-50). Cannot run twice (US-22), keeps all work on failure, and
 * stores the result in `builderStore.publish`. The edit token stays in memory only.
 * Returns true on success.
 */
export async function publishDraft(): Promise<boolean> {
  const store = useBuilderStore.getState();
  if (store.publish.phase === 'publishing') return false;

  const issues = validateDraft(
    { fields: store, photos: store.photos, consent: store.consent },
    'publish',
  );
  if (issues.length > 0) return false;

  const editToken = store.editToken;
  if (!editToken) {
    store.setPublish({ phase: 'failed', error: MSG_PUBLISH_FAILED });
    return false;
  }

  store.setPublish({ phase: 'publishing', error: null });
  try {
    const response = await getApi().publish(editToken, buildMuseumDocument(store, store.photos));
    useBuilderStore.getState().setPublish({
      phase: 'done',
      error: null,
      shareToken: response.shareToken,
      expiresAt: response.expiresAt,
    });
    return true;
  } catch (error) {
    const extra =
      isApiError(error) && error.code === 'rate_limited'
        ? " That's a lot of tries in a short time. Please wait a few minutes and try again."
        : '';
    useBuilderStore
      .getState()
      .setPublish({ phase: 'failed', error: `${MSG_PUBLISH_FAILED}${extra}` });
    return false;
  }
}
