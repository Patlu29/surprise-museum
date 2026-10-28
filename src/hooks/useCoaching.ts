import { useEffect, useState } from 'react';
import { inputState } from '@/state/inputState';
import { useSessionStore } from '@/state/sessionStore';

type MoveStage = 'move' | 'gap' | 'walk' | 'done';

const HINT_MS = 8000;
const GAP_MS = 3000;

/**
 * One quiet coaching hint at a time, each shown once per session, never modal (design spec 6.1):
 * how to move, then (about 3 s later, if no presentation has happened) how to get a presentation,
 * then, after the first presentation, how to open a picture. Hints auto-hide; Help re-reads them.
 */
export function useCoaching(
  active: boolean,
  options: { guideName: string; touch: boolean },
): string | null {
  const [moveStage, setMoveStage] = useState<MoveStage>('move');
  const [tapDone, setTapDone] = useState(false);
  const presented = useSessionStore(
    (state) => state.viewed.size > 0 || state.presentation.kind !== 'none',
  );
  const tapVisible =
    active &&
    presented &&
    !tapDone &&
    (moveStage === 'gap' || moveStage === 'walk' || moveStage === 'done');

  useEffect(() => {
    if (!active) return;
    if (moveStage === 'move') {
      const timer = setTimeout(() => setMoveStage('gap'), HINT_MS);
      const poll = setInterval(() => {
        if (inputState.move.x !== 0 || inputState.move.y !== 0) setMoveStage('gap');
      }, 250);
      return () => {
        clearTimeout(timer);
        clearInterval(poll);
      };
    }
    if (moveStage === 'gap') {
      const timer = setTimeout(() => setMoveStage('walk'), GAP_MS);
      return () => clearTimeout(timer);
    }
    if (moveStage === 'walk') {
      const timer = setTimeout(() => setMoveStage('done'), HINT_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [active, moveStage]);

  useEffect(() => {
    if (!tapVisible) return;
    const timer = setTimeout(() => setTapDone(true), HINT_MS);
    return () => clearTimeout(timer);
  }, [tapVisible]);

  if (!active) return null;
  if (moveStage === 'move') {
    return options.touch
      ? 'Drag the circle to walk. Drag anywhere else to look around.'
      : 'W A S D or the arrow keys to walk. Drag to look around.';
  }
  if (tapVisible) {
    return options.touch ? 'Tap a picture to look closer.' : 'Click a picture to look closer.';
  }
  if (moveStage === 'walk' && !presented) {
    return `Walk up to a picture and ${options.guideName} will tell you about it.`;
  }
  return null;
}
