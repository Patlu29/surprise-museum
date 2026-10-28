/**
 * The real browser client (ADR 0012): `fetch` for JSON calls to the Edge Functions and
 * `XMLHttpRequest` for photo uploads, so progress can be reported (FR-4). No supabase-js.
 *
 * - Every call is `POST {baseUrl}/functions/v1/<name>` with `Content-Type: application/json`,
 *   `apikey` and `x-region` headers. Tokens travel in the body, never in a URL.
 * - Errors become `ApiRequestError` (the class the stores already test with `instanceof`).
 * - Reads (`getMuseum`, `manageGet`) retry up to twice on network errors and 502, 503 and 504
 *   (cold starts). Writes never retry: reserving a photo is not safe to repeat blindly.
 */
import type {
  ApiError,
  ConfirmPhotoResponse,
  CreateMuseumResponse,
  DeleteResponse,
  GetMuseumResponse,
  ManageGetResponse,
  ManageMuseumRequest,
  PhotoUploadTicket,
  PublishResponse,
  RemovePhotoResponse,
} from '@contract';
import { FUNCTION_NAMES } from '@contract';
import type { ApiFailureCode, ConfirmPhotoInput, MuseumApi } from '@/lib/apiPort';
import { ApiRequestError } from '@/lib/apiPort';

export interface LiveApiOptions {
  /** Supabase project URL, no trailing slash. */
  baseUrl: string;
  /** Public anon or publishable key. */
  anonKey: string;
  /** Edge Function region header. Defaults to ap-southeast-2 (Sydney). */
  region?: string;
  timeoutMs?: number;
  uploadTimeoutMs?: number;
  /** Base delay between retries of reads. */
  retryDelayMs?: number;
  /** Injected for tests. */
  fetch?: typeof fetch;
  /** Injected for tests. */
  createXhr?: () => XMLHttpRequest;
}

const KNOWN_CODES: ReadonlySet<string> = new Set([
  'bad_request',
  'not_found',
  'conflict',
  'photo_limit',
  'upload_quota',
  'invalid_image',
  'rate_limited',
  'server_error',
]);

const RETRYABLE_STATUS = new Set([502, 503, 504]);

function linkSignals(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

async function readError(response: Response): Promise<ApiRequestError> {
  let body: Partial<ApiError> = {};
  try {
    body = (await response.json()) as Partial<ApiError>;
  } catch {
    // Not JSON (for example a gateway error page): fall back to the status code.
  }
  const code: ApiFailureCode =
    typeof body.error === 'string' && KNOWN_CODES.has(body.error)
      ? (body.error as ApiFailureCode)
      : response.status === 404
        ? 'not_found'
        : response.status === 429
          ? 'rate_limited'
          : 'server_error';
  const retryAfter = Number(response.headers.get('Retry-After'));
  return new ApiRequestError(code, typeof body.message === 'string' ? body.message : '', {
    status: response.status,
    ...(typeof body.field === 'string' ? { field: body.field } : {}),
    ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {}),
  });
}

export function createLiveApi(options: LiveApiOptions): MuseumApi & { readonly kind: 'live' } {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const region = options.region || 'ap-southeast-2';
  const timeoutMs = options.timeoutMs ?? 30_000;
  const uploadTimeoutMs = options.uploadTimeoutMs ?? 120_000;
  const retryDelayMs = options.retryDelayMs ?? 400;
  const doFetch: typeof fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const configured = Boolean(baseUrl && options.anonKey);

  async function attempt<T>(name: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const linked = linkSignals(signal, timeoutMs);
    try {
      let response: Response;
      try {
        response = await doFetch(`${baseUrl}/functions/v1/${name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: options.anonKey,
            'x-region': region,
          },
          body: JSON.stringify(body),
          signal: linked.signal,
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
      } catch {
        if (signal?.aborted) throw new ApiRequestError('aborted', 'The request was cancelled.');
        if (linked.didTimeOut()) throw new ApiRequestError('timeout', 'The request timed out.');
        throw new ApiRequestError('network', 'The network request failed.');
      }
      if (!response.ok) throw await readError(response);
      try {
        return (await response.json()) as T;
      } catch {
        throw new ApiRequestError('server_error', 'The server sent an unreadable reply.', {
          status: response.status,
        });
      }
    } finally {
      linked.done();
    }
  }

  async function call<T>(
    name: string,
    body: unknown,
    signal?: AbortSignal,
    retries = 0,
  ): Promise<T> {
    if (!configured) {
      throw new ApiRequestError('unconfigured', 'The backend is not configured in this build.');
    }
    for (let tries = 0; ; tries++) {
      try {
        return await attempt<T>(name, body, signal);
      } catch (error) {
        const retryable =
          error instanceof ApiRequestError &&
          (error.code === 'network' ||
            error.code === 'timeout' ||
            RETRYABLE_STATUS.has(error.status));
        if (!retryable || tries >= retries || signal?.aborted) throw error;
        await sleep(retryDelayMs * (tries + 1), signal);
      }
    }
  }

  const manage = <T>(request: ManageMuseumRequest, signal?: AbortSignal, retries = 0) =>
    call<T>(FUNCTION_NAMES.manageMuseum, request, signal, retries);

  function uploadPhotoFile(
    signedUrl: string,
    blob: Blob,
    onProgress: (fraction: number) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const xhr = options.createXhr ? options.createXhr() : new XMLHttpRequest();
      const cleanup = () => signal?.removeEventListener('abort', onAbort);
      const onAbort = () => xhr.abort();
      xhr.open('PUT', signedUrl);
      xhr.timeout = uploadTimeoutMs;
      // Storage's signed upload URL needs these two headers (docs/api.md, "Photo upload").
      xhr.setRequestHeader('Content-Type', 'image/jpeg');
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
      };
      xhr.onload = () => {
        cleanup();
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(1);
          resolve();
        } else {
          reject(
            new ApiRequestError('server_error', 'The photo upload was refused.', {
              status: xhr.status,
            }),
          );
        }
      };
      xhr.onerror = () => {
        cleanup();
        reject(new ApiRequestError('network', 'The upload failed.'));
      };
      xhr.ontimeout = () => {
        cleanup();
        reject(new ApiRequestError('timeout', 'The upload timed out.'));
      };
      xhr.onabort = () => {
        cleanup();
        reject(new ApiRequestError('aborted', 'The upload was cancelled.'));
      };
      if (signal) {
        if (signal.aborted) {
          reject(new ApiRequestError('aborted', 'The upload was cancelled.'));
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }
      xhr.send(blob);
    });
  }

  return {
    kind: 'live',
    createMuseum: (signal) => call<CreateMuseumResponse>(FUNCTION_NAMES.createMuseum, {}, signal),
    getMuseum: (shareToken, signal) =>
      call<GetMuseumResponse>(FUNCTION_NAMES.getMuseum, { shareToken }, signal, 2),
    manageGet: (editToken, signal) =>
      manage<ManageGetResponse>({ action: 'get', editToken }, signal, 2),
    reservePhoto: (editToken, signal) =>
      manage<PhotoUploadTicket>({ action: 'reserve-photo', editToken }, signal),
    renewUpload: (editToken, photoId, signal) =>
      manage<PhotoUploadTicket>({ action: 'renew-upload', editToken, photoId }, signal),
    confirmPhoto: (editToken, input: ConfirmPhotoInput, signal) =>
      manage<ConfirmPhotoResponse>(
        {
          action: 'confirm-photo',
          editToken,
          photoId: input.photoId,
          width: input.width,
          height: input.height,
          lqip: input.lqip,
        },
        signal,
      ),
    removePhoto: (editToken, photoId, signal) =>
      manage<RemovePhotoResponse>({ action: 'remove-photo', editToken, photoId }, signal),
    publish: (editToken, document, signal) =>
      manage<PublishResponse>({ action: 'publish', editToken, document }, signal),
    deleteMuseum: (editToken, signal) =>
      manage<DeleteResponse>({ action: 'delete', editToken }, signal),
    uploadPhotoFile,
  };
}
