/** Photo formats the builder accepts (FR-2), detected from the file's bytes, not its name. */
export type SourceKind = 'jpeg' | 'png' | 'webp' | 'heic';

/** The three renditions the museum needs (ADR 0005), all fresh JPEGs with no metadata (FR-10). */
export interface ProcessedPhoto {
  /** 2048 px long edge at most. Opened in the full-screen viewer. */
  full: Blob;
  /** 1024 px long edge at most. Used as the wall texture. */
  wall: Blob;
  /** `data:image/jpeg;base64,...` of about 24 px, shown until the wall texture loads. */
  lqip: string;
  /** Pixel size of `full`. The aspect ratio drives the frame shape (FR-39). */
  width: number;
  height: number;
  /** Pixel size of `wall`. */
  wallWidth: number;
  wallHeight: number;
  sourceKind: SourceKind;
}

export type MediaErrorCode =
  'unsupported-type' | 'too-large' | 'empty' | 'decode-failed' | 'heic-failed' | 'encode-failed';

export class MediaError extends Error {
  readonly code: MediaErrorCode;
  /** Set when decoding failed for a HEIC file, so the caller can try the lazy HEIC decoder. */
  readonly sourceKind: SourceKind | undefined;

  constructor(code: MediaErrorCode, message: string, sourceKind?: SourceKind) {
    super(message);
    this.name = 'MediaError';
    this.code = code;
    this.sourceKind = sourceKind;
  }
}

export interface Size {
  width: number;
  height: number;
}
