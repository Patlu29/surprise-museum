import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { editUrl, shareUrl } from '@/lib/links';
import { useBuilderStore } from '@/state/builderStore';
import { effectiveTitle } from '@/state/draft';
import { discardDraft } from '@/state/uploadQueue';
import { Alert } from '@/ui/components/Alert';
import { Button, ButtonLink } from '@/ui/components/Button';
import { DemoNotice } from '@/ui/components/DemoNotice';
import { LinkField } from '@/ui/components/LinkField';

/**
 * After publishing (FR-47, FR-50): the share link with Copy and Share, and the private edit link
 * with a "save this" warning that must be acknowledged before Finish. The edit link is shown here
 * only. It is never put in storage, and the browser's leave-site prompt stays on until Finish.
 */
export function PublishedScreen() {
  const [, navigate] = useLocation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const editToken = useBuilderStore((state) => state.editToken);
  const publish = useBuilderStore((state) => state.publish);
  const title = useBuilderStore((state) => state.title);
  const visitorName = useBuilderStore((state) => state.visitorName);
  const guideName = useBuilderStore((state) => state.guideName);
  const acknowledged = useBuilderStore((state) => state.editLinkAcknowledged);
  const acknowledge = useBuilderStore((state) => state.acknowledgeEditLink);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const finish = () => {
    if (!acknowledged) {
      setTried(true);
      return;
    }
    discardDraft();
    navigate('/');
  };

  if (!publish.shareToken || !editToken) return null;
  const link = shareUrl(publish.shareToken);

  return (
    <div className="stack published">
      <div className="stack">
        <h1 ref={headingRef} tabIndex={-1}>
          Your museum is ready
        </h1>
        <p className="muted">
          Anyone with the share link can visit, so send it only to{' '}
          <span className="user-text">{visitorName}</span>.
        </p>
      </div>

      <DemoNotice context="published" />

      <section className="stack" aria-labelledby="share-heading">
        <h2 id="share-heading">Share link</h2>
        <p>
          Send this to <span className="user-text">{visitorName}</span>. Opening it on a phone works
          best.
        </p>
        <LinkField
          label="Share link"
          url={link}
          shareData={{
            title: effectiveTitle(title, visitorName),
            text: `${guideName.trim() || 'Someone'} made you a little museum.`,
          }}
        />
        <div>
          <ButtonLink variant="tertiary" icon="external" href={link} external>
            Open my museum<span className="visually-hidden"> (opens in a new tab)</span>
          </ButtonLink>
        </div>
      </section>

      <section className="stack" aria-labelledby="edit-heading">
        <h2 id="edit-heading">Private edit link</h2>
        <Alert tone="warning" title="Save this link now" role="none">
          <p>
            It is the only way to change or delete your museum, and we can&apos;t recover it if you
            lose it. Don&apos;t share it.
          </p>
        </Alert>
        <LinkField label="Private edit link" url={editUrl(editToken)} copyLabel="Copy edit link" />
        <label className="consent">
          <input
            type="checkbox"
            checked={acknowledged}
            aria-describedby={tried && !acknowledged ? 'ack-error' : undefined}
            onChange={(event) => acknowledge(event.target.checked)}
          />
          <span>I&apos;ve saved my edit link.</span>
        </label>
        {tried && !acknowledged ? (
          <p id="ack-error" role="alert" className="field__error">
            Please tick the box once you have saved your edit link.
          </p>
        ) : null}
      </section>

      <div>
        <Button variant="primary" large unavailable={!acknowledged} onClick={finish}>
          Finish
        </Button>
        {!acknowledged ? (
          <p className="muted">Finish is available once you have saved your edit link.</p>
        ) : null}
      </div>
    </div>
  );
}
