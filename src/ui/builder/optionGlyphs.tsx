import type { ReactNode } from 'react';
import type { AvatarFaceShape, AvatarOutfitPattern } from '@contract';

/**
 * Pictograms for the "More options" tiles (design spec 12.5.3). All are decorative: the text label
 * on every tile is the accessible name. Face shapes are bare outlines with no hair, features or
 * expression. Garments sit on one shared neutral torso, filled with the current outfit colour
 * (`--swatch`). Nothing here is tied to a gender (FR-99).
 */

const FACE_PATHS: Readonly<Record<AvatarFaceShape, string>> = {
  oval: 'M16 4c5.500 0 9 5 9 12s-3.500 12-9 12-9-5-9-12S10.500 4 16 4z',
  round: 'M16 5a11 11 0 100 22 11 11 0 000-22z',
  square: 'M9 5h14a3 3 0 013 3v11c0 5-4 8-10 8s-10-3-10-8V8a3 3 0 013-3z',
  heart: 'M6 12c0-5 4-8 10-8s10 3 10 8c0 6-5 11-10 16C11 23 6 18 6 12z',
  long: 'M16 2c4.500 0 8 5 8 14s-3.500 14-8 14-8-5-8-14S11.500 2 16 2z',
};

export function FaceShapeGlyph({ shape }: { shape: AvatarFaceShape }): ReactNode {
  return (
    <svg viewBox="0 0 32 32" className="glyph glyph--face" aria-hidden="true" focusable="false">
      <path d={FACE_PATHS[shape]} />
    </svg>
  );
}

/** Garment silhouettes on a 24 by 24 grid. The first path is the garment, the rest are details. */
const GARMENTS: Readonly<Record<string, { body: string; detail?: string }>> = {
  sweater: {
    body: 'M8 4l-5 4 2 7 3-1v7h8v-7l3 1 2-7-5-4c-1 1.500-2.300 2-4 2s-3-.500-4-2z',
    detail: 'M9 4.500c1 1.200 2 1.800 3 1.800s2-.600 3-1.800',
  },
  overalls: {
    body: 'M8 3v5H6v13h4l2-6 2 6h4V8h-2V3h-2v5h-4V3z',
    detail: 'M10 8h4v4h-4z',
  },
  coat: {
    body: 'M8 3l-4 4 1 14h5l2-8 2 8h5l1-14-4-4-4 3z',
    detail: 'M12 6v15M8 3l4 6M16 3l-4 6',
  },
  tracksuit: {
    body: 'M8 4l-5 4 2 7 3-1v7h8v-7l3 1 2-7-5-4z',
    detail: 'M12 4v17M5.500 9l1.500 4M18.500 9L17 13',
  },
  cardigan: {
    body: 'M8 4l-5 4 2 7 3-1v7h3l1-12 1 12h3v-7l3 1 2-7-5-4z',
    detail: 'M12 10v.01M12 14v.01M12 18v.01',
  },
  tunic: {
    body: 'M8 4l-5 4 2 6 3-1v8h8v-8l3 1 2-6-5-4c-1 1.500-2.300 2-4 2s-3-.500-4-2z',
    detail: 'M9 21v-4M15 21v-4',
  },
};

export function GarmentGlyph({ style }: { style: string }): ReactNode {
  const garment = GARMENTS[style] ?? GARMENTS.sweater!;
  return (
    <svg viewBox="0 0 24 24" className="glyph glyph--garment" aria-hidden="true" focusable="false">
      <path d={garment.body} className="glyph__fill" />
      {garment.detail ? <path d={garment.detail} className="glyph__detail" /> : null}
    </svg>
  );
}

/** A CSS fabric swatch in the current outfit colour and its derived tint (design spec 12.5.3). */
export function PatternGlyph({ pattern }: { pattern: AvatarOutfitPattern }): ReactNode {
  return <span className={`fabric fabric--${pattern}`} aria-hidden="true" />;
}
