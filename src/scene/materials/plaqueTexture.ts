/**
 * Plaque textures drawn with the 2D canvas (design spec 1.4, "Plaques").
 *
 * Text is drawn into a `CanvasTexture` using the display font, so the scene needs no font
 * download and emoji and accents work exactly as typed. Browser only (needs `document`).
 * Textures redraw once `document.fonts.ready` resolves, so a late font never leaves a plaque in
 * the fallback face.
 */
import { CanvasTexture, SRGBColorSpace } from 'three';
import { SCENE_PALETTE } from './palette';

const DISPLAY_FONT =
  "'Fraunces Variable', 'Fraunces', 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const UI_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Greedy word wrap. `measure` returns the width of a string. Words longer than `maxWidth` are
 * split by code point, so unbroken names and emoji strings never overflow. At most `maxLines`
 * lines are returned; if text remains, the last line ends with an ellipsis.
 */
export function wrapLines(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  const flush = () => {
    if (current) lines.push(current);
    current = '';
  };
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    flush();
    if (measure(word) <= maxWidth) {
      current = word;
      continue;
    }
    // Break an over-long word by code point.
    let piece = '';
    for (const ch of word) {
      if (measure(piece + ch) > maxWidth && piece) {
        lines.push(piece);
        piece = ch;
      } else {
        piece += ch;
      }
    }
    current = piece;
  }
  flush();
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1] ?? '';
  while (last && measure(`${last}…`) > maxWidth) last = [...last].slice(0, -1).join('');
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

function plaqueBorder(ctx: CanvasRenderingContext2D, w: number, h: number, inset: number): void {
  ctx.fillStyle = SCENE_PALETTE.brass;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SCENE_PALETTE.brassDeep;
  ctx.fillRect(inset * 0.45, inset * 0.45, w - inset * 0.9, h - inset * 0.9);
  ctx.fillStyle = SCENE_PALETTE.plaque;
  ctx.fillRect(inset, inset, w - inset * 2, h - inset * 2);
}

function makeTexture(canvas: HTMLCanvasElement, redraw: () => void): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  if (typeof document !== 'undefined' && document.fonts) {
    void document.fonts.ready.then(() => {
      redraw();
      texture.needsUpdate = true;
    });
  }
  return texture;
}

/** A numbered plaque (0.18 by 0.12 m, aspect 3:2). Release 2. */
export function createNumberPlaqueTexture(number: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 128;
  const draw = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    plaqueBorder(ctx, canvas.width, canvas.height, 8);
    ctx.fillStyle = SCENE_PALETTE.plaqueInk;
    ctx.font = `600 72px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), canvas.width / 2, canvas.height / 2 + 4);
  };
  draw();
  return makeTexture(canvas, draw);
}

export interface TitlePlaqueText {
  /** Small caps line, normally "A PRIVATE VIEW". */
  eyebrow: string;
  /** The museum title; wraps to at most 3 lines. */
  title: string;
  /** For example "For Sophie". */
  forLine: string;
  /** For example "Curated by Tom". */
  curatedLine: string;
}

/**
 * The entrance hall's title plaque. Aspect 1.4:1, intended at about 1.1 by 0.8 m.
 * Order, top to bottom: eyebrow, title, "For {Visitor}", "Curated by {Guide}".
 */
export function createTitlePlaqueTexture(text: TitlePlaqueText): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 732;
  const draw = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width: w, height: h } = canvas;
    plaqueBorder(ctx, w, h, 26);
    ctx.fillStyle = SCENE_PALETTE.plaqueInk;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const maxWidth = w - 150;

    ctx.font = `600 34px ${UI_FONT}`;
    ctx.save();
    // Letter-spacing makes the small caps feel like a museum label.
    if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = '6px';
    ctx.fillStyle = SCENE_PALETTE.brassDeep;
    ctx.fillText(text.eyebrow.toUpperCase(), w / 2, 118);
    ctx.restore();

    ctx.font = `600 78px ${DISPLAY_FONT}`;
    const lines = wrapLines((s) => ctx.measureText(s).width, text.title, maxWidth, 3);
    const lineHeight = 90;
    const blockTop = 240 - ((lines.length - 1) * lineHeight) / 2;
    ctx.fillStyle = SCENE_PALETTE.plaqueInk;
    lines.forEach((line, i) => ctx.fillText(line, w / 2, blockTop + i * lineHeight));

    ctx.fillStyle = SCENE_PALETTE.brass;
    ctx.fillRect(w / 2 - 70, 430, 140, 4);

    ctx.fillStyle = SCENE_PALETTE.plaqueInk;
    ctx.font = `400 italic 48px ${DISPLAY_FONT}`;
    const forLines = wrapLines((s) => ctx.measureText(s).width, text.forLine, maxWidth, 1);
    ctx.fillText(forLines[0] ?? '', w / 2, 520);
    ctx.font = `400 38px ${DISPLAY_FONT}`;
    const byLines = wrapLines((s) => ctx.measureText(s).width, text.curatedLine, maxWidth, 1);
    ctx.fillText(byLines[0] ?? '', w / 2, 600);
  };
  draw();
  return makeTexture(canvas, draw);
}
