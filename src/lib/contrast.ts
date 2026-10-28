/** WCAG contrast helpers, used to pick a readable letter colour for the Guide's badge (design spec 5.6). */

export function parseHexColor(value: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!match || !match[1]) return null;
  const hex = match[1];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Returns whichever of `dark` or `light` contrasts more with `background`. */
export function pickReadableInk(
  background: [number, number, number],
  dark: [number, number, number],
  light: [number, number, number],
): 'dark' | 'light' {
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? 'dark' : 'light';
}
