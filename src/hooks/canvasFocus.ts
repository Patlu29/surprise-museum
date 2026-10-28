let canvasElement: HTMLElement | null = null;

/** The focusable museum wrapper registers itself so overlays can return focus to it (design spec 5.8). */
export function registerCanvasElement(element: HTMLElement | null): void {
  canvasElement = element;
}

export function focusCanvas(): void {
  canvasElement?.focus({ preventScroll: true });
}
