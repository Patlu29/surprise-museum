/**
 * Canvas cursor (design spec 6.2 and 6.5): pointer over a picture. When the scene owns drag input
 * (CanvasInput) it also sets grab and grabbing; otherwise the UI's wrapper styles those and the
 * scene only overrides the cursor while a picture is hovered. Desktop only in effect.
 */
let canvas: HTMLElement | null = null;
let ownsDrag = false;
let hovering = false;
let dragging = false;

function apply(): void {
  if (!canvas) return;
  if (hovering) canvas.style.cursor = 'pointer';
  else if (ownsDrag) canvas.style.cursor = dragging ? 'grabbing' : 'grab';
  else canvas.style.cursor = '';
}

export function attachCursor(element: HTMLElement | null, ownsDragCursor = false): void {
  canvas = element;
  ownsDrag = ownsDragCursor;
  apply();
}

export function setPictureHover(value: boolean): void {
  hovering = value;
  apply();
}

export function setDragging(value: boolean): void {
  dragging = value;
  apply();
}
