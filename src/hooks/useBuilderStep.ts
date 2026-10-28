import { useCallback, useEffect, useState } from 'react';
import type { BuilderStep } from '@/state/draft';
import { useBuilderStore } from '@/state/builderStore';

function readStep(): BuilderStep | null {
  const value = (window.history.state as { builderStep?: unknown } | null)?.builderStep;
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
}

/**
 * The builder's step, held in browser history state with no new hash routes (design spec 2.1).
 * Back goes to the previous step instead of leaving the builder and the in-memory draft is
 * kept. The step is also remembered in `builderStore` so Exit preview returns to the same place.
 */
export function useBuilderStep(): { step: BuilderStep; goTo: (step: BuilderStep) => void } {
  const remembered = useBuilderStore((state) => state.step);
  const setRemembered = useBuilderStore((state) => state.setStep);
  const [step, setStep] = useState<BuilderStep>(() => readStep() ?? remembered);

  useEffect(() => {
    if (readStep() === null) {
      window.history.replaceState(
        { ...(window.history.state as object | null), builderStep: step },
        '',
      );
    }
    const onPop = () => {
      const next = readStep();
      if (next) {
        setStep(next);
        setRemembered(next);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // Only on mount: later steps are pushed by goTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback(
    (next: BuilderStep) => {
      if (next === readStep()) return;
      window.history.pushState(
        { ...(window.history.state as object | null), builderStep: next },
        '',
      );
      setStep(next);
      setRemembered(next);
    },
    [setRemembered],
  );

  return { step, goTo };
}
