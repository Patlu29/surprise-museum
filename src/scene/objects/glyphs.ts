import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * In-frame glyphs (design spec 7.4): three dots while a photo loads, a circular arrow when it
 * failed. Drawn once into shared canvas textures; no font or image download.
 */
let dots: CanvasTexture | null = null;
let retry: CanvasTexture | null = null;

function make(draw: (g: CanvasRenderingContext2D, size: number) => void): CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (g) draw(g, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function getLoadingGlyph(): CanvasTexture {
  dots ??= make((g, s) => {
    g.fillStyle = 'rgba(31,22,32,0.78)';
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c9a15b';
    for (const dx of [-0.2, 0, 0.2]) {
      g.beginPath();
      g.arc(s / 2 + dx * s, s / 2, s * 0.06, 0, Math.PI * 2);
      g.fill();
    }
  });
  return dots;
}

export function getFailedGlyph(): CanvasTexture {
  retry ??= make((g, s) => {
    g.fillStyle = 'rgba(31,22,32,0.85)';
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#c9a15b';
    g.lineWidth = s * 0.07;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.22, Math.PI * 0.25, Math.PI * 1.75);
    g.stroke();
    // Arrow head at the arc's start.
    const a = Math.PI * 0.25;
    const cx = s / 2 + Math.cos(a) * s * 0.22;
    const cy = s / 2 + Math.sin(a) * s * 0.22;
    g.fillStyle = '#c9a15b';
    g.beginPath();
    g.moveTo(cx + s * 0.1, cy - s * 0.02);
    g.lineTo(cx - s * 0.04, cy - s * 0.1);
    g.lineTo(cx - s * 0.02, cy + s * 0.09);
    g.closePath();
    g.fill();
  });
  return retry;
}

export function disposeGlyphs(): void {
  dots?.dispose();
  retry?.dispose();
  dots = null;
  retry = null;
}
