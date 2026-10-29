import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';
import { LoadError, PhotoLoadQueue, type LoadStatus } from '@/domain/photos/loadQueue';

/** Closes a texture's ImageBitmap (a no-op for <img> sources, and when already closed). */
function releaseImage(texture: Texture): void {
  (texture.image as { close?: () => void } | null)?.close?.();
}

export interface PhotoSource {
  id: string;
  /** 1024 px wall rendition: a signed URL, or a blob: URL in preview. */
  wallUrl: string;
  /** Inline 24 px JPEG data URL, shown until the wall texture arrives (NFR-3). */
  lqip: string;
}

export interface PhotoTexturesOptions {
  onStatus: (id: string, status: LoadStatus) => void;
  onUrlsExpired?: () => void;
  /** Anisotropy: 4 on desktop and 2 on phones (architecture 6.10). */
  anisotropy: number;
  /**
   * The longest edge, in pixels, a wall texture is uploaded at. Read each time a photo is
   * decoded, so the graphics tier can change after the runtime is built. Renditions already at
   * or under it are used as they are. 0 or absent means no limit.
   */
  maxEdge?: () => number;
}

/**
 * Wall photo textures (ADR 0005, architecture 6.10). Each frame first shows its LQIP texture
 * (never blank, NFR-3). Wall renditions then download nearest-first, 3 at a time, through the
 * pure PhotoLoadQueue, are decoded with createImageBitmap, and uploaded as mip-mapped sRGB
 * textures. `full.jpg` is never a texture; the viewer loads it in an <img>.
 */
export class PhotoTextures {
  private readonly lqip = new Map<string, Texture>();
  private readonly walls = new Map<string, Texture>();
  private readonly queue: PhotoLoadQueue<Texture>;
  private readonly status = new Map<string, LoadStatus>();
  private readonly anisotropy: number;
  private readonly maxEdge: () => number;
  /** Test hook: ids that must fail every download. */
  private readonly forcedFailures = new Set<string>();
  private disposed = false;

  constructor(options: PhotoTexturesOptions) {
    this.anisotropy = options.anisotropy;
    this.maxEdge = options.maxEdge ?? (() => 0);
    this.queue = new PhotoLoadQueue<Texture>({
      load: (id, url, signal) => this.load(id, url, signal),
      onStatus: (id, status) => {
        this.status.set(id, status);
        options.onStatus(id, status);
      },
      onLoaded: (id, texture) => {
        this.walls.set(id, texture);
      },
      onUrlsExpired: options.onUrlsExpired,
    });
  }

  add(photos: readonly PhotoSource[]): void {
    const loader = new TextureLoader();
    for (const p of photos) {
      if (this.lqip.has(p.id)) continue;
      const tex = p.lqip ? loader.load(p.lqip) : new Texture();
      tex.colorSpace = SRGBColorSpace;
      tex.minFilter = LinearFilter;
      tex.magFilter = LinearFilter;
      tex.generateMipmaps = false;
      tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
      this.lqip.set(p.id, tex);
    }
    this.queue.add(photos.map((p) => ({ id: p.id, url: p.wallUrl })));
  }

  updateUrls(photos: readonly Pick<PhotoSource, 'id' | 'wallUrl'>[]): void {
    this.queue.updateUrls(photos.map((p) => ({ id: p.id, url: p.wallUrl })));
  }

  rank(distances: ReadonlyMap<string, number>): void {
    this.queue.rank(distances);
  }

  retry(id: string): void {
    this.forcedFailures.delete(id);
    this.queue.retry(id);
  }

  getLqip(id: string): Texture | null {
    return this.lqip.get(id) ?? null;
  }

  getTexture(id: string): Texture | null {
    return this.walls.get(id) ?? null;
  }

  statusOf(id: string): LoadStatus {
    return this.status.get(id) ?? 'placeholder';
  }

  get pendingCount(): number {
    return this.queue.pendingCount;
  }

  /** Resident wall textures and their estimated GPU bytes (RGBA8 plus a third for mipmaps). */
  residentStats(): { count: number; bytes: number } {
    let bytes = 0;
    for (const t of this.walls.values()) bytes += (t.userData.gpuBytes as number | undefined) ?? 0;
    return { count: this.walls.size, bytes: Math.round(bytes) };
  }

  /** Test hook: make a photo fail now and until the next manual retry, even if it had loaded. */
  forceFailure(id: string): void {
    this.forcedFailures.add(id);
    this.queue.setBackoff([20, 20, 20]); // later retries fail fast too, not after 13 s
    const wall = this.walls.get(id);
    if (wall) {
      wall.dispose();
      this.walls.delete(id);
    }
    this.queue.forceFail(id);
  }

  dispose(): void {
    this.disposed = true;
    this.queue.dispose();
    for (const t of this.lqip.values()) t.dispose();
    for (const t of this.walls.values()) {
      releaseImage(t);
      t.dispose();
    }
    this.lqip.clear();
    this.walls.clear();
  }

  // ---- Download and decode ---------------------------------------------------------------

  private async load(id: string, url: string, signal: AbortSignal): Promise<Texture> {
    if (this.forcedFailures.has(id)) throw new LoadError('Forced failure (test hook)');
    // blob: and data: URLs are decoded through an <img>, because the production CSP's
    // connect-src does not cover them. Signed https URLs use fetch, so HTTP status is visible.
    const viaImage = url.startsWith('blob:') || url.startsWith('data:');
    const texture = viaImage
      ? await this.loadViaImage(url, signal)
      : await this.loadViaFetch(url, signal);
    if (signal.aborted || this.disposed) {
      releaseImage(texture);
      texture.dispose();
      throw new DOMException('Aborted', 'AbortError');
    }
    return texture;
  }

  private async loadViaFetch(url: string, signal: AbortSignal): Promise<Texture> {
    let response: Response;
    try {
      response = await fetch(url, { signal, mode: 'cors', credentials: 'omit' });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new LoadError('Network error');
    }
    if (!response.ok) throw new LoadError(`HTTP ${response.status}`, response.status);
    const blob = await response.blob();
    if (typeof createImageBitmap !== 'function') {
      return this.loadViaImage(URL.createObjectURL(blob), signal, true);
    }
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY' });
      bitmap = await this.fitToMaxEdge(bitmap);
    } catch {
      throw new LoadError('Could not decode the image');
    }
    return this.fromBitmap(bitmap);
  }

  /** A mip-mapped texture from an already flipped bitmap, which is closed once it is on the GPU. */
  private fromBitmap(bitmap: ImageBitmap): Texture {
    const texture = this.prepare(new Texture(bitmap));
    texture.flipY = false; // the bitmap is already flipped
    texture.onUpdate = () => {
      bitmap.close();
      texture.onUpdate = null;
    };
    return texture;
  }

  /**
   * Shrinks a decoded rendition to the tier's texture limit with the browser's own high-quality
   * resampler (off the main thread), so the GPU holds, and the main thread uploads, only the
   * pixels that can show. A browser that ignores the resize options just hands back the full
   * size, which is still correct. The intermediate bitmap is closed straight away.
   */
  private async fitToMaxEdge(bitmap: ImageBitmap): Promise<ImageBitmap> {
    const limit = this.maxEdge();
    const long = Math.max(bitmap.width, bitmap.height);
    if (limit <= 0 || long <= limit) return bitmap;
    const scale = limit / long;
    try {
      const small = await createImageBitmap(bitmap, {
        resizeWidth: Math.max(1, Math.round(bitmap.width * scale)),
        resizeHeight: Math.max(1, Math.round(bitmap.height * scale)),
        resizeQuality: 'high',
      });
      bitmap.close();
      return small;
    } catch {
      return bitmap;
    }
  }

  private loadViaImage(url: string, signal: AbortSignal, revoke = false): Promise<Texture> {
    return new Promise<Texture>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const cleanup = () => {
        if (revoke) URL.revokeObjectURL(url);
      };
      img.onload = () => {
        cleanup();
        this.textureFromImage(img).then(resolve, reject);
      };
      img.onerror = () => {
        cleanup();
        reject(new LoadError('Could not load the image'));
      };
      signal.addEventListener('abort', () => {
        img.src = '';
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      });
      img.src = url;
    });
  }

  /** The preview and demo path: an <img> is shrunk the same way as a fetched rendition. */
  private async textureFromImage(img: HTMLImageElement): Promise<Texture> {
    const limit = this.maxEdge();
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    if (typeof createImageBitmap === 'function' && limit > 0 && long > limit) {
      try {
        const scale = limit / long;
        const bitmap = await createImageBitmap(img, {
          imageOrientation: 'flipY',
          resizeWidth: Math.max(1, Math.round(img.naturalWidth * scale)),
          resizeHeight: Math.max(1, Math.round(img.naturalHeight * scale)),
          resizeQuality: 'high',
        });
        return this.fromBitmap(bitmap);
      } catch {
        // Fall through to the full-size image.
      }
    }
    return this.prepare(new Texture(img));
  }

  private prepare(texture: Texture): Texture {
    // The bitmap is closed after upload (its size then reads 0), so keep the estimate now.
    const image = texture.image as { width: number; height: number };
    texture.userData.gpuBytes = Math.round(image.width * image.height * 4 * (4 / 3));
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.anisotropy = this.anisotropy;
    texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }
}
