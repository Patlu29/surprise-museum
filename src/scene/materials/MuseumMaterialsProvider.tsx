import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, type ReactNode } from 'react';
import { MuseumMaterialsContext } from './MuseumMaterialsContext';
import { createMuseumMaterials } from './museumMaterials';
import type { GraphicsQuality } from './quality';

export interface MuseumMaterialsProviderProps {
  quality?: GraphicsQuality;
  /** Effective reduced-motion value from settingsStore. */
  reducedMotion?: boolean;
  children: ReactNode;
}

/**
 * Creates the museum materials once per quality tier, advances their time uniforms every frame
 * and disposes them on unmount. Children read them with `useMuseumMaterials()`.
 */
export function MuseumMaterialsProvider({
  quality = 'high',
  reducedMotion = false,
  children,
}: MuseumMaterialsProviderProps) {
  const materials = useMemo(() => createMuseumMaterials(quality), [quality]);

  useEffect(() => {
    materials.setReducedMotion(reducedMotion);
  }, [materials, reducedMotion]);

  useEffect(() => () => materials.dispose(), [materials]);

  useFrame((state) => materials.update(state.clock.elapsedTime));

  return (
    <MuseumMaterialsContext.Provider value={materials}>{children}</MuseumMaterialsContext.Provider>
  );
}
