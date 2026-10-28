import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/ui/components/Alert';
import { Button } from '@/ui/components/Button';
import { ProgressBar } from '@/ui/components/ProgressBar';

interface WelcomeScreenProps {
  title: string;
  visitorName: string;
  guideName: string;
  /** Start was pressed but the scene is not ready yet. */
  waiting: boolean;
  /** 0 to 1, or null when the scene reports no progress. */
  progress: number | null;
  leaving: boolean;
  inAppBrowser: string | null;
  onStart: () => void;
}

/**
 * The welcome screen (FR-24, design spec 7.2): "A private view", the title, "For {name}",
 * "Your guide today: {Guide}" and a large Start button that has focus. The scene loads behind
 * it, so Start is usually instant; otherwise the button shows real progress.
 */
export function WelcomeScreen({
  title,
  visitorName,
  guideName,
  waiting,
  progress,
  leaving,
  inAppBrowser,
  onStart,
}: WelcomeScreenProps) {
  const startRef = useRef<HTMLButtonElement>(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    startRef.current?.focus({ preventScroll: true });
  }, []);

  // The status text changes in 25% steps so screen readers are not flooded.
  const step = progress === null ? null : Math.floor(progress * 4) * 25;

  return (
    <main
      className={['welcome', leaving && 'is-leaving'].filter(Boolean).join(' ')}
      aria-labelledby="welcome-title"
    >
      <div className="welcome__stack">
        {inAppBrowser && !noticeDismissed ? (
          <Alert
            tone="info"
            title="Open in your browser"
            onDismiss={() => setNoticeDismissed(true)}
          >
            <p>
              {inAppBrowser}&apos;s built-in browser can struggle with 3D. For the best view, copy
              the link and open it in Safari or Chrome.
            </p>
            <div>
              <Button
                variant="secondary"
                icon={copied ? 'check' : 'copy'}
                onClick={() => {
                  navigator.clipboard
                    .writeText(window.location.href)
                    .then(() => setCopied(true))
                    .catch(() => undefined);
                }}
              >
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          </Alert>
        ) : null}

        <div className="welcome__card surface-paper">
          <p className="eyebrow">A private view</p>
          <h1 id="welcome-title" className="welcome__title user-text">
            {title}
          </h1>
          <p className="welcome__for">
            For <span className="user-text">{visitorName}</span>
          </p>
          <p className="muted">
            Your guide today: <span className="user-text">{guideName}</span>
          </p>
          <Button
            ref={startRef}
            variant="primary"
            large
            className="welcome__start"
            loading={waiting}
            onClick={onStart}
          >
            {waiting ? 'Getting the gallery ready' : 'Start'}
          </Button>
          {waiting ? (
            <div className="welcome__progress">
              <ProgressBar value={progress} label="Getting the gallery ready" />
              <p className="muted" role="status">
                {step === null ? 'Hanging the pictures...' : `Hanging the pictures... ${step}%`}
              </p>
            </div>
          ) : null}
          <a
            className="welcome__privacy"
            href="#/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy
          </a>
        </div>
      </div>
    </main>
  );
}
