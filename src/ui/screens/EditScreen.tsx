import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'wouter';
import type { ManageGetResponse } from '@contract';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { describeApiError, getApi, isApiError } from '@/lib/apiPort';
import { isEditToken, shareUrl } from '@/lib/links';
import { effectiveTitle } from '@/state/draft';
import { Alert } from '@/ui/components/Alert';
import { Button, ButtonLink } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';
import { LinkField } from '@/ui/components/LinkField';
import { LoadingScreen } from '@/ui/screens/LoadingScreen';
import { MessageScreen } from '@/ui/screens/MessageScreen';
import { NotFoundScreen } from '@/ui/screens/NotFoundScreen';

type Load =
  | { state: 'loading' }
  | { state: 'ready'; data: ManageGetResponse }
  | { state: 'not-found' }
  | { state: 'error'; message: string }
  | { state: 'deleted' };

/**
 * The private edit link, `#/edit/:editToken` (FR-50, FR-52). The MVP offers view, copy share
 * link and delete; full editing is Release 2 (FR-51). The page refuses to run inside a frame,
 * because a meta CSP cannot set `frame-ancestors` (architecture 10.4).
 */
export default function EditScreen() {
  const { editToken = '' } = useParams<{ editToken: string }>();
  const framed = typeof window !== 'undefined' && window.top !== window.self;
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useDocumentTitle('Manage your museum');

  const fetchMuseum = useCallback(
    async (signal?: AbortSignal) => {
      setLoad({ state: 'loading' });
      try {
        const data = await getApi().manageGet(editToken, signal);
        setLoad({ state: 'ready', data });
      } catch (error) {
        if (signal?.aborted) return;
        if (isApiError(error) && error.code === 'not_found') setLoad({ state: 'not-found' });
        else setLoad({ state: 'error', message: describeApiError(error) });
      }
    },
    [editToken],
  );

  useEffect(() => {
    if (framed || !isEditToken(editToken)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void fetchMuseum(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [editToken, framed, fetchMuseum]);

  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await getApi().deleteMuseum(editToken);
      setConfirming(false);
      setLoad({ state: 'deleted' });
    } catch (error) {
      setDeleteError(describeApiError(error));
    } finally {
      setDeleting(false);
    }
  };

  if (framed) {
    return (
      <MessageScreen heading="This page can't open here">
        <p>For your safety, your private edit link can only be opened directly in your browser.</p>
      </MessageScreen>
    );
  }
  // A malformed token cannot exist; answer the same way as an unknown one.
  if (!isEditToken(editToken) || load.state === 'not-found') return <NotFoundScreen />;
  if (load.state === 'loading') return <LoadingScreen heading="Opening your museum" />;

  if (load.state === 'deleted') {
    return (
      <MessageScreen heading="Your museum has been deleted">
        <p>The link no longer works.</p>
        <div>
          <ButtonLink variant="primary" large href="/create">
            Make a new museum
          </ButtonLink>
        </div>
      </MessageScreen>
    );
  }

  if (load.state === 'error') {
    return (
      <MessageScreen
        alert
        heading="We couldn't open your museum"
        actions={
          <Button variant="primary" onClick={() => void fetchMuseum()}>
            Try again
          </Button>
        }
      >
        <p>{load.message}</p>
      </MessageScreen>
    );
  }

  const { data } = load;
  const document = data.document;
  const title = document
    ? effectiveTitle(document.title, document.visitorName)
    : 'Your draft museum';
  const link = data.shareToken ? shareUrl(data.shareToken) : null;

  return (
    <div className="page">
      <header className="home__header">
        <p className="home__brand">Surprise Museum</p>
      </header>
      <main className="page__main">
        <div className="stack">
          <p className="eyebrow">Your private edit page</p>
          <h1 className="user-text">{title}</h1>
          {document ? (
            <p className="muted">
              For <span className="user-text">{document.visitorName}</span>, guided by{' '}
              <span className="user-text">{document.guideName}</span>. {data.photos.length}{' '}
              {data.photos.length === 1 ? 'photo' : 'photos'}.
            </p>
          ) : (
            <Alert tone="info" title="Not published yet" role="none">
              <p>This museum has not been published, so there is no share link yet.</p>
            </Alert>
          )}
        </div>

        {data.photos.length > 0 ? (
          <ul className="edit-photos" aria-label="Photos">
            {data.photos.map((photo, index) => (
              <li key={photo.id}>
                <span
                  className="edit-photos__thumb"
                  style={{ backgroundImage: `url(${photo.lqip})` }}
                >
                  <img
                    src={photo.wallUrl}
                    alt={photo.caption.trim() || `Photo ${index + 1} of ${data.photos.length}`}
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {link && document ? (
          <section className="stack" aria-labelledby="share-heading">
            <h2 id="share-heading">Share link</h2>
            <LinkField
              label="Share link"
              url={link}
              shareData={{
                title: effectiveTitle(document.title, document.visitorName),
                text: `${document.guideName} made you a little museum.`,
              }}
            />
          </section>
        ) : null}

        <section className="stack" aria-labelledby="delete-heading">
          <h2 id="delete-heading">Delete this museum</h2>
          <p className="muted">
            The link stops working straight away, and your photos and words are removed. This
            can&apos;t be undone.
          </p>
          <div>
            <Button variant="danger" icon="trash" onClick={() => setConfirming(true)}>
              Delete museum
            </Button>
          </div>
        </section>
      </main>

      <Dialog
        open={confirming}
        onClose={() => (deleting ? undefined : setConfirming(false))}
        role="alertdialog"
        title="Delete this museum for good?"
        description={`${document?.visitorName ?? 'The'}${document ? "'s" : ''} link will stop working straight away, and your photos and words will be removed. This can't be undone.`}
        initialFocusRef={cancelRef}
      >
        {deleteError ? (
          <Alert tone="danger" title="We couldn't delete it">
            {deleteError}
          </Alert>
        ) : null}
        <div className="dialog__actions">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={() => setConfirming(false)}
            unavailable={deleting}
          >
            Cancel
          </Button>
          <Button variant="danger" loading={deleting} onClick={() => void remove()}>
            {deleting ? 'Deleting...' : 'Delete museum'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
