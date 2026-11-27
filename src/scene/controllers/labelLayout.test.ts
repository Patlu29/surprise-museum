import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import {
  clampDown,
  clampShiftX,
  layoutLabels,
  LABEL_EDGE_MARGIN,
  insideShiftX,
  riseShiftY,
  separateShiftX,
  stackShiftY,
  type LabelActor,
} from './labelLayout';

describe('clampDown (BUG-10)', () => {
  it('moves a label that sits under the strip down to the strip bottom', () => {
    expect(clampDown({ top: 183.9 }, 192)).toBeCloseTo(8.1);
  });
  it('leaves a label that is already clear', () => {
    expect(clampDown({ top: 200 }, 192)).toBe(0);
  });
});

const box = (left: number, w: number, top = 100, h = 40) => ({
  left,
  right: left + w,
  top,
  bottom: top + h,
});

describe('clampShiftX (12.6.8 rule 1)', () => {
  it('brings a label clipped by the left edge 8 px inside', () => {
    expect(clampShiftX(box(-30, 158), 8, 352)).toBe(38);
  });
  it('brings a label clipped by the right edge 8 px inside', () => {
    expect(clampShiftX(box(250, 158), 8, 352)).toBe(-56);
  });
  it('leaves a label that is inside', () => {
    expect(clampShiftX(box(100, 158), 8, 352)).toBe(0);
  });
});

describe('separateShiftX (12.6.8 rule 2)', () => {
  it('does nothing when the labels do not overlap', () => {
    expect(separateShiftX(box(8, 100), box(150, 100), 8, 352)).toEqual([0, 0]);
    // Overlapping in x but not in y.
    expect(separateShiftX(box(8, 100, 100), box(50, 100, 200), 8, 352)).toEqual([0, 0]);
  });

  it('pushes two overlapping labels apart by half the overlap plus the gap each', () => {
    const a = box(100, 100);
    const b = box(160, 100); // overlap 40
    const [da, db] = separateShiftX(a, b, 8, 400);
    expect(da).toBeCloseTo(-24);
    expect(db).toBeCloseTo(24);
    expect(b.left + db - (a.right + da)).toBeCloseTo(8);
  });

  it('re-clamps, and moves the label that has room when one is against the edge', () => {
    const a = box(8, 158);
    const b = box(60, 158);
    const [da, db] = separateShiftX(a, b, 8, 352);
    const l1 = a.left + da;
    const l2 = b.left + db;
    expect(l1).toBeGreaterThanOrEqual(8);
    expect(l2 + 158).toBeLessThanOrEqual(352);
    expect(l2 - (l1 + 158)).toBeGreaterThanOrEqual(8 - 1e-9);
  });

  it('is symmetric in its arguments', () => {
    const a = box(100, 100);
    const b = box(160, 100);
    const ab = separateShiftX(a, b, 8, 400);
    const ba = separateShiftX(b, a, 8, 400);
    expect(ab[0]).toBeCloseTo(ba[1]);
    expect(ab[1]).toBeCloseTo(ba[0]);
  });

  it('always resolves two maximum-width labels at 360 px (2 x 158 + 8 gap = 324 <= 344)', () => {
    for (let gap = -150; gap < 0; gap += 10) {
      const a = box(100, 158);
      const b = box(100 + 158 + gap, 158);
      const [da, db] = separateShiftX(a, b, 8, 352);
      const left = a.left < b.left ? { l: a.left + da, w: 158 } : { l: b.left + db, w: 158 };
      const right = a.left < b.left ? b.left + db : a.left + da;
      expect(right - (left.l + left.w), `gap ${gap}`).toBeGreaterThanOrEqual(8 - 1e-9);
      expect(Math.min(a.left + da, b.left + db)).toBeGreaterThanOrEqual(8 - 1e-9);
      expect(Math.max(a.left + da, b.left + db) + 158).toBeLessThanOrEqual(352 + 1e-9);
    }
  });
});

/** A minimal label element: a box size, an opacity, and the style and dataset it writes. */
function fakeLabel(w: number, h: number) {
  return {
    dataset: {} as Record<string, string>,
    style: { opacity: '1', translate: '', visibility: '', maxWidth: '' },
    getBoundingClientRect: () => ({ width: w, height: h }),
  } as unknown as HTMLElement & { style: { translate: string; visibility: string } };
}

/**
 * A label that wraps like text: one line is `natural` wide, the box is at most `cap` wide (or
 * `wideCap` once the solver widens it) and every extra line adds `line` px of height.
 */
function wrapLabel(natural: number, cap: number, wideCap: number, line = 18, pad = 15) {
  const el = fakeLabel(0, 0);
  el.getBoundingClientRect = () => {
    const width = Math.min(natural, el.dataset.wide === '1' ? wideCap : cap);
    const lines = Math.ceil((natural - pad) / (width - pad));
    return { width, height: lines * line + pad } as DOMRect;
  };
  return el;
}

describe('layoutLabels on a 360x640 portrait screen (N-10)', () => {
  // Camera behind the origin looking down -z; project the heads to chosen pixels by placing the
  // actors across the view.
  const camera = new PerspectiveCamera(60, 360 / 640, 0.1, 100);
  camera.position.set(0, 2, 5);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const area = { left: 0, top: 0, width: 360, height: 640 };

  const actors = (
    guideX: number,
    visitorX: number,
    g: HTMLElement,
    v: HTMLElement,
  ): LabelActor[] => [
    { role: 'visitor', element: v, x: visitorX, z: 0, height: 1.7 },
    { role: 'guide', element: g, x: guideX, z: 0, height: 1.7 },
  ];

  it('keeps a 24-character Guide label fully inside the viewport and apart from the Visitor label', () => {
    const g = fakeLabel(158, 68);
    const v = fakeLabel(110, 32);
    const out = layoutLabels(actors(-1.35, -1.0, g, v), camera, area, null, 192);
    const gr = out.guide!;
    const vr = out.visitor!;
    expect(gr.x).toBeGreaterThanOrEqual(LABEL_EDGE_MARGIN - 1e-9);
    expect(gr.x + gr.width).toBeLessThanOrEqual(360 - LABEL_EDGE_MARGIN + 1e-9);
    expect(vr.x).toBeGreaterThanOrEqual(LABEL_EDGE_MARGIN - 1e-9);
    expect(vr.x + vr.width).toBeLessThanOrEqual(360 - LABEL_EDGE_MARGIN + 1e-9);
    const apart =
      gr.x + gr.width <= vr.x ||
      vr.x + vr.width <= gr.x ||
      gr.y + gr.height <= vr.y ||
      vr.y + vr.height <= gr.y;
    expect(apart).toBe(true);
    // The BUG-10 rule still holds: neither label is above the strip.
    expect(gr.y).toBeGreaterThanOrEqual(192 - 1e-9);
    expect(vr.y).toBeGreaterThanOrEqual(192 - 1e-9);
  });

  it('never changes label size', () => {
    const g = fakeLabel(158, 68);
    const v = fakeLabel(110, 32);
    const out = layoutLabels(actors(-1.35, -1.0, g, v), camera, area, null, 192);
    expect(out.guide!.width).toBe(158);
    expect(out.guide!.height).toBeCloseTo(68, 6);
  });

  it('hides a label whose head is off screen sideways, and shows it again', () => {
    const g = fakeLabel(158, 68);
    const v = fakeLabel(110, 32);
    const out = layoutLabels(actors(-30, 0, g, v), camera, area, null, null);
    expect(out.guide).toBeNull();
    expect(g.style.visibility).toBe('hidden');
    expect(out.visitor).not.toBeNull();
    layoutLabels(actors(-0.5, 0.5, g, v), camera, area, null, null);
    expect(g.style.visibility).toBe('');
  });

  it('keeps a partly visible body its label', () => {
    const g = fakeLabel(158, 40);
    const v = fakeLabel(110, 32);
    // Head just inside the left edge: the label is pulled in, not hidden.
    const out = layoutLabels(actors(-1.5, 0.8, g, v), camera, area, null, null);
    expect(out.guide).not.toBeNull();
    expect(out.guide!.x).toBeGreaterThanOrEqual(LABEL_EDGE_MARGIN - 1e-9);
  });

  it('puts the picture before the edge: the label stays clear of the picture, at most 40% past the edge', () => {
    const g = fakeLabel(158, 40);
    const v = fakeLabel(110, 32);
    // A picture rectangle over the left part of the screen where the Guide's head is.
    const picture = { x: 0, y: 200, width: 220, height: 400 };
    const out = layoutLabels(actors(-1.2, 0.9, g, v), camera, area, picture, null);
    const r = out.guide!;
    expect(r.x).toBeGreaterThanOrEqual(-0.4 * 158 - LABEL_EDGE_MARGIN - 1e-6);
    expect(r.x + r.width).toBeLessThanOrEqual(360 - LABEL_EDGE_MARGIN + 0.4 * 158 + 1e-6);
  });

  it('stacks two labels vertically when the picture keeps them from sitting apart sideways (BUG-15)', () => {
    const g = fakeLabel(158, 68);
    const v = fakeLabel(158, 50);
    // A wide picture that leaves no clear room at either side for two labels.
    const picture = { x: 100, y: 150, width: 160, height: 300 };
    const out = layoutLabels(actors(0.3, -0.3, g, v), camera, area, picture, 192);
    const gr = out.guide!;
    const vr = out.visitor!;
    const apart =
      gr.x + gr.width <= vr.x ||
      vr.x + vr.width <= gr.x ||
      gr.y + gr.height <= vr.y ||
      vr.y + vr.height <= gr.y;
    expect(apart).toBe(true);
    expect(gr.y).toBeGreaterThanOrEqual(192 - 1e-9);
    expect(vr.y).toBeGreaterThanOrEqual(192 - 1e-9);
  });
});

describe('stackShiftY (BUG-15)', () => {
  it('moves the lower label to sit under the upper one, never up', () => {
    expect(stackShiftY({ bottom: 100 }, { top: 90 })).toBe(14);
    expect(stackShiftY({ bottom: 100 }, { top: 120 })).toBe(0);
    expect(stackShiftY({ bottom: 100 }, { top: 90 }, 0)).toBe(10);
  });
});

describe('insideShiftX (FR-109, BUG-15)', () => {
  it('rounds inwards: up against the left margin, down against the right one', () => {
    // Left edge at 7.4 after a 0.4 px shift: nearest rounding gives 0, inwards gives 1.
    expect(insideShiftX({ left: 7.6, right: 107.6 }, -0.4, 8, 352)).toBe(1);
    expect(insideShiftX({ left: 7.6, right: 107.6 }, 0.4, 8, 352)).toBe(1);
    expect(7.6 + insideShiftX({ left: 7.6, right: 107.6 }, 0.4, 8, 352)).toBeGreaterThanOrEqual(8);
    // Right edge at 352.4 against a 352 margin.
    const out = insideShiftX({ left: 252.4, right: 352.4 }, -0.4, 8, 352);
    expect(352.4 + out).toBeLessThanOrEqual(352);
  });
  it('never leaves an edge inside the margin whatever the fraction', () => {
    for (let i = 0; i < 200; i++) {
      const left = 100 + i * 0.37;
      const w = 90.3 + i * 0.11;
      for (const dx of [-250.49, -250.51, 244.49, 244.51, -3.5, 0.5]) {
        const out = insideShiftX({ left, right: left + w }, dx, 8, 352);
        expect(Number.isInteger(out)).toBe(true);
        if (w < 344) {
          expect(left + out).toBeGreaterThanOrEqual(8);
          expect(left + w + out).toBeLessThanOrEqual(352);
        }
      }
    }
  });
});

describe('riseShiftY (13.8 step 2)', () => {
  it('raises the upper label to 4 px above the lower one', () => {
    expect(riseShiftY({ bottom: 110 }, { top: 100 })).toBe(14);
    expect(riseShiftY({ bottom: 90 }, { top: 100 })).toBe(0);
  });
});

describe('layoutLabels, stacked labels (13.8, FR-111)', () => {
  const camera = new PerspectiveCamera(60, 360 / 640, 0.1, 100);
  camera.position.set(0, 2, 5);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const area = { left: 0, top: 0, width: 360, height: 640 };
  const actors = (g: HTMLElement, v: HTMLElement, gz: number, vz: number): LabelActor[] => [
    { role: 'visitor', element: v, x: 0.2, z: vz, height: 1.7 },
    { role: 'guide', element: g, x: -0.2, z: gz, height: 1.7 },
  ];

  it('raises one label clear of the other without widening', () => {
    // Both heads at about the same screen height, labels side by side would not fit.
    const g = fakeLabel(200, 33);
    const v = fakeLabel(200, 33);
    const out = layoutLabels(actors(g, v, 0, 0.05), camera, area, null, null);
    const gr = out.guide!;
    const vr = out.visitor!;
    const [upper, lower] = gr.y < vr.y ? [gr, vr] : [vr, gr];
    // The collision raise (5.5 rule 2) already clears them; the gap is at least 3 px.
    expect(upper.y + upper.height).toBeLessThanOrEqual(lower.y - 3);
    expect(g.dataset.wide ?? '').toBe('');
  });

  it('widens both labels when the picture and the strip stop the upper label rising, and drops last', () => {
    const g = wrapLabel(245, 200, 344);
    const v = wrapLabel(245, 200, 344);
    // Strip floor right above the anchors: no room to rise, so both widen to one line.
    const out = layoutLabels(actors(g, v, 0, 0.05), camera, area, null, 300);
    expect(g.dataset.wide).toBe('1');
    expect(v.dataset.wide).toBe('1');
    expect(out.guide!.height).toBeCloseTo(33, 6);
    expect(out.guide!.x).toBeGreaterThanOrEqual(8);
    expect(out.guide!.x + out.guide!.width).toBeLessThanOrEqual(352);
    // 4 px apart vertically, so the drop (last resort) applied.
    const [u, l] =
      out.guide!.y < out.visitor!.y ? [out.guide!, out.visitor!] : [out.visitor!, out.guide!];
    expect(l.y - (u.y + u.height)).toBeGreaterThanOrEqual(4 - 1e-9);
  });

  it('returns both labels to their normal width when they stop being stacked', () => {
    const g = wrapLabel(245, 200, 344);
    const v = wrapLabel(245, 200, 344);
    layoutLabels(actors(g, v, 0, 0.05), camera, area, null, 300);
    expect(g.dataset.wide).toBe('1');
    const apart: LabelActor[] = [
      { role: 'visitor', element: v, x: 1.0, z: 0, height: 1.7 },
      { role: 'guide', element: g, x: -1.0, z: 3, height: 1.7 },
    ];
    layoutLabels(apart, camera, area, null, null);
    expect(g.dataset.wide ?? '').toBe('');
    expect(v.dataset.wide ?? '').toBe('');
  });
});
