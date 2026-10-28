import { useEffect, useState } from 'react';
import { FrameMark } from '@/ui/components/FrameMark';
import { ProgressBar } from '@/ui/components/ProgressBar';

/**
 * Never a blank screen (FR-57, design spec 7.1). The first paint of the route: the brass frame
 * mark, "Opening your surprise" and an indeterminate progress line. After six seconds the
 * message becomes "Almost there".
 */
export function LoadingScreen({ heading = 'Opening your surprise' }: { heading?: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <main className="message-screen message-screen--loading" aria-busy="true">
      <div className="message-screen__card">
        <FrameMark sweeping />
        <h1>{heading}</h1>
        <ProgressBar value={null} label="Opening" className="loading-bar" />
        <p className="muted" role="status">
          {slow ? 'Almost there' : ''}
        </p>
      </div>
    </main>
  );
}
