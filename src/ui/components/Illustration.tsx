import { useState } from 'react';
import { FrameMark } from './FrameMark';

interface IllustrationProps {
  kind: 'home' | 'not-found';
}

/**
 * Shows the technical-artist's SVG when it exists at `public/textures/illustrations/<kind>.svg`,
 * and the built-in frame mark otherwise. Decorative (`aria-hidden`).
 */
export function Illustration({ kind }: IllustrationProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <FrameMark crooked={kind === 'not-found'} />;
  return (
    <img
      className="illustration"
      src={`${import.meta.env.BASE_URL}textures/illustrations/${kind}.svg`}
      alt=""
      aria-hidden="true"
      width={320}
      height={240}
      onError={() => setFailed(true)}
    />
  );
}
