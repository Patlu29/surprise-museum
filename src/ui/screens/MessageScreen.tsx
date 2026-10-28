import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

interface MessageScreenProps {
  illustration?: ReactNode;
  heading: string;
  children?: ReactNode;
  actions?: ReactNode;
  /** `alert` announces the message at once (design spec 7.6). */
  alert?: boolean;
  /** Cover the scene (visit screens) rather than fill the page. */
  overlay?: boolean;
}

/** One layout for every full-screen message: not found, couldn't open, WebGL unavailable. */
export function MessageScreen({
  illustration,
  heading,
  children,
  actions,
  alert,
  overlay,
}: MessageScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <main
      className={['message-screen', overlay && 'message-screen--overlay'].filter(Boolean).join(' ')}
    >
      <div className="message-screen__card" role={alert ? 'alert' : undefined}>
        {illustration ? <div className="message-screen__art">{illustration}</div> : null}
        <h1 ref={headingRef} tabIndex={-1}>
          {heading}
        </h1>
        <div className="stack">{children}</div>
        {actions ? <div className="row message-screen__actions">{actions}</div> : null}
      </div>
    </main>
  );
}
