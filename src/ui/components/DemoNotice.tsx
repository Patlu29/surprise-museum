import { useCallback, useEffect, useRef, useState } from 'react';
import { clearDemoData, getApiMode, getDemoDataInfo } from '@/api';
import type { DemoDataInfo } from '@/api';
import { formatBytes } from '@/lib/format';
import { announce } from '@/state/announcer';
import { useBuilderStore } from '@/state/builderStore';
import { reuploadAfterDemoReset } from '@/state/uploadQueue';
import { Alert } from './Alert';
import { Button } from './Button';
import { Dialog } from './Dialog';

interface DemoNoticeProps {
  /**
   * `builder`: clearing keeps the draft and uploads the photos again into a new demo draft.
   * `published`: clearing removes the museum that was just made, and the dialog says so.
   */
  context: 'builder' | 'published';
}

function whereKept(kind: DemoDataInfo['storage']): string {
  switch (kind) {
    case 'indexeddb':
      return 'in this browser';
    case 'localstorage':
      return 'in this browser, in a small store, so only a few photos fit';
    case 'memory':
      return 'in this tab only, and it is lost when the tab closes';
  }
}

/**
 * Shown only when the app runs against the in-memory demo backend (no Supabase project). It tells
 * the Creator the link will not work for anyone else, shows how much demo storage is used, and
 * offers "Clear demo data" behind a confirmation whose default focus is Cancel. In a real build
 * (live mode) it renders nothing.
 */
export function DemoNotice({ context }: DemoNoticeProps) {
  const demo = getApiMode() === 'mock';
  const [info, setInfo] = useState<DemoDataInfo | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Re-read the storage figures as photos finish uploading.
  const readyPhotos = useBuilderStore(
    (state) => state.photos.filter((photo) => photo.status === 'ready').length,
  );

  const refresh = useCallback(async (): Promise<DemoDataInfo | null> => {
    try {
      return await getDemoDataInfo();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!demo) return;
    let current = true;
    void refresh().then((next) => {
      if (current) setInfo(next);
    });
    return () => {
      current = false;
    };
  }, [demo, refresh, readyPhotos]);

  if (!demo) return null;

  const clear = async () => {
    setClearing(true);
    setFailed(false);
    try {
      await clearDemoData();
      if (context === 'builder') reuploadAfterDemoReset();
      setConfirming(false);
      setCleared(true);
      setInfo(await refresh());
      announce('Demo data cleared');
    } catch {
      setFailed(true);
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <Alert tone="warning" title="Demo copy" role="none">
        <p>
          This copy of the app is not connected to its server. Your museum is kept only in this
          browser, so the link will not work for anyone else.
        </p>
        {info ? (
          <p>
            Demo storage: {formatBytes(info.usedBytes)} of {formatBytes(info.capacityBytes)} used (
            {info.museums} {info.museums === 1 ? 'museum' : 'museums'}, {info.photos}{' '}
            {info.photos === 1 ? 'photo' : 'photos'}), kept {whereKept(info.storage)}.
          </p>
        ) : null}
        <div className="row">
          <Button variant="secondary" icon="trash" onClick={() => setConfirming(true)}>
            Clear demo data
          </Button>
          <span role="status" className={cleared ? undefined : 'visually-hidden'}>
            {cleared
              ? context === 'published'
                ? 'Demo data cleared. The museum you made is gone.'
                : 'Demo data cleared. Your photos are uploading again.'
              : ''}
          </span>
        </div>
      </Alert>

      <Dialog
        open={confirming}
        onClose={() => (clearing ? undefined : setConfirming(false))}
        role="alertdialog"
        title="Clear all demo data?"
        description={
          context === 'published'
            ? 'This removes every demo museum, photo and draft stored in this browser, including the museum you just made. Its share and edit links will stop working.'
            : 'This removes every demo museum, photo and draft stored in this browser. Your photos and words on this page stay, and your photos will upload again.'
        }
        initialFocusRef={cancelRef}
      >
        {failed ? (
          <Alert tone="danger" title="We couldn't clear it">
            <p>Please try again.</p>
          </Alert>
        ) : null}
        <div className="dialog__actions">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={() => setConfirming(false)}
            unavailable={clearing}
          >
            Cancel
          </Button>
          <Button variant="danger" loading={clearing} onClick={() => void clear()}>
            {clearing ? 'Clearing...' : 'Clear demo data'}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
