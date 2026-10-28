import { useEffect, useMemo } from 'react';
import { MeshBasicMaterial } from 'three';
import { createPlaqueGeometry } from '../materials/geometry/frames';
import { createTitlePlaqueTexture } from '../materials/plaqueTexture';

/**
 * The entrance hall's title plaque (design spec 1.4, MVP). The technical-artist's texture draws
 * the text into a canvas with the display font and redraws once `document.fonts.ready` resolves,
 * so the scene downloads no font and emoji and accents render as typed. Decorative: the same
 * information is in the UI.
 */
interface TitlePlaqueProps {
  title: string;
  visitorName: string;
  guideName: string;
  position: [number, number, number];
}

export function TitlePlaque({ title, visitorName, guideName, position }: TitlePlaqueProps) {
  const texture = useMemo(
    () =>
      createTitlePlaqueTexture({
        eyebrow: 'A private view',
        title,
        forLine: `For ${visitorName}`,
        curatedLine: `Curated by ${guideName}`,
      }),
    [title, visitorName, guideName],
  );
  const geometry = useMemo(() => createPlaqueGeometry(1.1, 0.8), []);
  const material = useMemo(
    () => new MeshBasicMaterial({ map: texture, toneMapped: false }),
    [texture],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Faces +X: it hangs on the left wall of the entrance hall.
  return (
    <mesh
      position={position}
      rotation-y={Math.PI / 2}
      geometry={geometry}
      material={material}
      raycast={() => null}
    />
  );
}
