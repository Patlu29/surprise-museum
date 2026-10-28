import { createContext, useContext } from 'react';
import type { MuseumMaterials } from './museumMaterials';

export const MuseumMaterialsContext = createContext<MuseumMaterials | null>(null);

/** The shared museum materials. Throws if used outside `<MuseumMaterialsProvider>`. */
export function useMuseumMaterials(): MuseumMaterials {
  const value = useContext(MuseumMaterialsContext);
  if (!value) throw new Error('useMuseumMaterials must be used inside <MuseumMaterialsProvider>');
  return value;
}
