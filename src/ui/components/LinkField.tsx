import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './Button';

interface LinkFieldProps {
  label: string;
  url: string;
  /** Offer the device share sheet when the browser has one (US-28). */
  shareData?: { title: string; text: string };
  copyLabel?: string;
}

/**
 * Read-only link with Copy and, where available, Share (design spec 5.15). On a copy failure the
 * link stays selected so the person can copy it by hand.
 */
export function LinkField({ label, url, shareData, copyLabel = 'Copy link' }: LinkFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function' && !!shareData;

  useEffect(() => {
    if (state !== 'copied') return;
    const timer = setTimeout(() => setState('idle'), 3000);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setState('failed');
    }
  };

  const share = async () => {
    if (!shareData) return;
    try {
      await navigator.share({ ...shareData, url });
    } catch {
      // The person closed the share sheet. Nothing to report.
    }
  };

  return (
    <div className="link-field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        className="field__control link-field__input"
        type="text"
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className="link-field__actions">
        <Button
          variant="primary"
          large
          icon={state === 'copied' ? 'check' : 'copy'}
          onClick={() => void copy()}
        >
          {state === 'copied' ? 'Copied' : copyLabel}
        </Button>
        {canShare ? (
          <Button variant="secondary" large icon="share" onClick={() => void share()}>
            Share...
          </Button>
        ) : null}
      </div>
      <p role="status" className={state === 'failed' ? 'field__error' : 'visually-hidden'}>
        {state === 'copied' ? 'Link copied' : ''}
        {state === 'failed'
          ? "We couldn't copy automatically. The link is selected: press and hold, then choose Copy."
          : ''}
      </p>
    </div>
  );
}
