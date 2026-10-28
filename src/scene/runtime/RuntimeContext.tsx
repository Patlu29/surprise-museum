import { createContext, useContext } from 'react';
import type { SceneRuntime } from './SceneRuntime';

export const RuntimeContext = createContext<SceneRuntime | null>(null);

export function useRuntime(): SceneRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error('useRuntime must be used inside <SceneRoot>.');
  return runtime;
}
