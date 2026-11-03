import { useMemo } from 'react';
import { useBuilderStore } from '@/state/builderStore';
import type { DraftIssue, DraftMode } from '@/state/draft';
import { validateDraft } from '@/state/draft';

/**
 * The draft's current issues for a mode. One function, two views: the "Still to do" chips use
 * 'publish', the Preview dialog uses 'preview' (design spec 12.4.3).
 */
export function useDraftIssues(mode: DraftMode): DraftIssue[] {
  const visitorName = useBuilderStore((state) => state.visitorName);
  const guideName = useBuilderStore((state) => state.guideName);
  const photos = useBuilderStore((state) => state.photos);
  const consent = useBuilderStore((state) => state.consent);
  return useMemo(
    () =>
      validateDraft(
        {
          fields: {
            ...useBuilderStore.getState(),
            visitorName,
            guideName,
          },
          photos,
          consent,
        },
        mode,
      ),
    [visitorName, guideName, photos, consent, mode],
  );
}
