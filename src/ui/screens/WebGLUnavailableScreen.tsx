import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { MessageScreen } from './MessageScreen';
import type { ReactNode } from 'react';

/** WebGL cannot start (FR-59, design spec 7.7). The 2D slideshow is Release 2 (FR-60). */
export function WebGLUnavailableScreen({ actions }: { actions?: ReactNode }) {
  useDocumentTitle("This device can't show the 3D museum");
  return (
    <MessageScreen overlay alert heading="This device can't show the 3D museum" actions={actions}>
      <p>
        Your browser couldn&apos;t start the 3D view. Try the latest Chrome, Safari, Edge or
        Firefox, and check that hardware acceleration is turned on in its settings.
      </p>
    </MessageScreen>
  );
}
