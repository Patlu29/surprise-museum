import type {
  ApiErrorCode,
  ConfirmPhotoResponse,
  CreateMuseumResponse,
  DeleteResponse,
  GetMuseumResponse,
  ManageGetResponse,
  MuseumDocument,
  PhotoUploadTicket,
  PublishResponse,
  RemovePhotoResponse,
} from '@contract';

/**
 * The thin interface the UI and stores use to reach the backend (ADR 0012).
 *
 * The typed client in `src/api` belongs to the backend-developer. Until it is wired in, this
 * port lets the frontend code against the contract in docs/architecture.md section 7. To swap
 * the implementation, call `setApi()` once at start-up (src/main.tsx) with anything that
 * implements `MuseumApi`. Nothing else in the frontend imports a concrete client.
 */

/** Errors the client can raise on top of the codes the server returns. */
export type ApiFailureCode = ApiErrorCode | 'network' | 'timeout' | 'unconfigured' | 'aborted';

export class ApiRequestError extends Error {
  readonly code: ApiFailureCode;
  readonly status: number;
  readonly field: string | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code: ApiFailureCode,
    message: string,
    options: { status?: number; field?: string; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = options.status ?? 0;
    this.field = options.field;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function isApiError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

export interface ConfirmPhotoInput {
  photoId: string;
  width: number;
  height: number;
  lqip: string;
}

export interface MuseumApi {
  /** create-museum: starts a draft when the first photo is added. */
  createMuseum(signal?: AbortSignal): Promise<CreateMuseumResponse>;
  /** get-museum: the Visitor's read-only view. */
  getMuseum(shareToken: string, signal?: AbortSignal): Promise<GetMuseumResponse>;
  /** manage-museum action `get`. */
  manageGet(editToken: string, signal?: AbortSignal): Promise<ManageGetResponse>;
  reservePhoto(editToken: string, signal?: AbortSignal): Promise<PhotoUploadTicket>;
  renewUpload(editToken: string, photoId: string, signal?: AbortSignal): Promise<PhotoUploadTicket>;
  confirmPhoto(
    editToken: string,
    input: ConfirmPhotoInput,
    signal?: AbortSignal,
  ): Promise<ConfirmPhotoResponse>;
  removePhoto(
    editToken: string,
    photoId: string,
    signal?: AbortSignal,
  ): Promise<RemovePhotoResponse>;
  publish(
    editToken: string,
    document: MuseumDocument,
    signal?: AbortSignal,
  ): Promise<PublishResponse>;
  deleteMuseum(editToken: string, signal?: AbortSignal): Promise<DeleteResponse>;
  /**
   * PUT a JPEG to a signed upload URL, reporting progress from 0 to 1 (FR-4).
   * Raises `ApiRequestError` with code `network`, `timeout`, `aborted` or `server_error`.
   */
  uploadPhotoFile(
    signedUrl: string,
    blob: Blob,
    onProgress: (fraction: number) => void,
    signal?: AbortSignal,
  ): Promise<void>;
}

let current: MuseumApi | null = null;
let factory: (() => MuseumApi) | null = null;

/** Registers the default client factory. Called once, lazily, by `getApi()`. */
export function setApiFactory(create: () => MuseumApi): void {
  factory = create;
  current = null;
}

/** Replaces the client (tests, or the backend-developer's `src/api` client). */
export function setApi(api: MuseumApi | null): void {
  current = api;
}

export function getApi(): MuseumApi {
  if (current) return current;
  if (!factory) {
    throw new ApiRequestError('unconfigured', 'The backend client has not been set up.');
  }
  current = factory();
  return current;
}

/** Plain-language text for an error, safe to show to the Creator or the Visitor (never blames them). */
export function describeApiError(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong. Please try again.';
  switch (error.code) {
    case 'network':
    case 'timeout':
      return 'Check your connection and try again.';
    case 'rate_limited':
      return "That's a lot of tries in a short time. Please wait a few minutes and try again.";
    case 'unconfigured':
      return 'This copy of the app is not connected to its server yet.';
    case 'not_found':
      return "We couldn't find that museum.";
    case 'photo_limit':
      return 'You can add up to 20 photos. Remove one to add another.';
    case 'upload_quota':
      return 'This museum has used all its photo uploads. Please start a new museum.';
    case 'invalid_image':
      return "We couldn't accept that photo. Try a different one.";
    default:
      return error.message || 'Something went wrong. Please try again.';
  }
}
