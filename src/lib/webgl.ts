let cached: boolean | null = null;

/**
 * True when the browser can create a WebGL context (FR-59). The test context is released at
 * once, because iOS limits the number of live contexts. The result is cached for the session.
 */
export function isWebGLAvailable(): boolean {
  if (cached !== null) return cached;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const context =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (canvas.getContext('webgl') as WebGLRenderingContext | null);
    cached = Boolean(context);
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

/** For tests and the "Try again" path after the user changes browser settings. */
export function resetWebGLCache(): void {
  cached = null;
}
