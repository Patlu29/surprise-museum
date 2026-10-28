import { describe, expect, it, vi } from 'vitest';
import { createLiveApi } from '../liveClient';
import { ApiRequestError } from '@/lib/apiPort';

const EDIT = 'A'.repeat(43);
const PHOTO = '11111111-1111-4111-8111-111111111111';

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function setup(
  responder: (url: string, init: RequestInit) => Response | Promise<Response>,
  extra = {},
) {
  const calls: Array<{ url: string; init: RequestInit; body: unknown }> = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      init: init ?? {},
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return responder(String(url), init ?? {});
  });
  const api = createLiveApi({
    baseUrl: 'https://abc.supabase.co/',
    anonKey: 'anon-key',
    fetch: fetchMock as unknown as typeof fetch,
    retryDelayMs: 0,
    ...extra,
  });
  return { api, calls, fetchMock };
}

describe('createLiveApi requests', () => {
  it('posts JSON to /functions/v1/<name> with the apikey and region headers, tokens in the body only', async () => {
    const { api, calls } = setup(() => jsonResponse(201, { editToken: EDIT, draftExpiresAt: 'x' }));
    await expect(api.createMuseum()).resolves.toEqual({ editToken: EDIT, draftExpiresAt: 'x' });
    await api.reservePhoto(EDIT).catch(() => undefined);

    expect(calls[0]?.url).toBe('https://abc.supabase.co/functions/v1/create-museum');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.headers).toEqual({
      'Content-Type': 'application/json',
      apikey: 'anon-key',
      'x-region': 'ap-southeast-2',
    });
    expect(calls[0]?.init.credentials).toBe('omit');
    expect(calls[0]?.init.referrerPolicy).toBe('no-referrer');
    expect(calls[0]?.body).toEqual({});
    expect(calls[1]?.url).toBe('https://abc.supabase.co/functions/v1/manage-museum');
    expect(calls[1]?.body).toEqual({ action: 'reserve-photo', editToken: EDIT });
    for (const call of calls) expect(call.url).not.toContain(EDIT);
  });

  it('sends the right body for every action', async () => {
    const { api, calls } = setup(() => jsonResponse(200, {}));
    await api.getMuseum('S'.repeat(24));
    await api.manageGet(EDIT);
    await api.renewUpload(EDIT, PHOTO);
    await api.confirmPhoto(EDIT, {
      photoId: PHOTO,
      width: 10,
      height: 8,
      lqip: 'data:image/jpeg;base64,AAAA',
    });
    await api.removePhoto(EDIT, PHOTO);
    await api.deleteMuseum(EDIT);
    const document = { title: '' } as never;
    await api.publish(EDIT, document);
    expect(calls.map((c) => c.body)).toEqual([
      { shareToken: 'S'.repeat(24) },
      { action: 'get', editToken: EDIT },
      { action: 'renew-upload', editToken: EDIT, photoId: PHOTO },
      {
        action: 'confirm-photo',
        editToken: EDIT,
        photoId: PHOTO,
        width: 10,
        height: 8,
        lqip: 'data:image/jpeg;base64,AAAA',
      },
      { action: 'remove-photo', editToken: EDIT, photoId: PHOTO },
      { action: 'delete', editToken: EDIT },
      { action: 'publish', editToken: EDIT, document },
    ]);
    expect(calls[0]?.url.endsWith('/get-museum')).toBe(true);
  });

  it('uses the configured region', async () => {
    const { api, calls } = setup(() => jsonResponse(200, {}), { region: 'ap-southeast-1' });
    await api.manageGet(EDIT);
    expect((calls[0]?.init.headers as Record<string, string>)['x-region']).toBe('ap-southeast-1');
  });

  it('refuses to call when the build has no Supabase configuration', async () => {
    const api = createLiveApi({ baseUrl: '', anonKey: '' });
    await expect(api.createMuseum()).rejects.toMatchObject({ code: 'unconfigured' });
  });
});

describe('createLiveApi errors', () => {
  it('maps the server error body to ApiRequestError with code, status, field and Retry-After', async () => {
    const { api } = setup(() =>
      jsonResponse(
        429,
        { error: 'rate_limited', message: 'Slow down.', field: 'x' },
        { 'Retry-After': '42' },
      ),
    );
    const error = await api.reservePhoto(EDIT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      code: 'rate_limited',
      status: 429,
      message: 'Slow down.',
      field: 'x',
      retryAfterSeconds: 42,
    });
  });

  it.each([
    [404, { error: 'not_found', message: 'm' }, 'not_found'],
    [409, { error: 'photo_limit', message: 'm' }, 'photo_limit'],
    [409, { error: 'upload_quota', message: 'm' }, 'upload_quota'],
    [422, { error: 'invalid_image', message: 'm', field: 'full' }, 'invalid_image'],
    [400, { error: 'bad_request', message: 'm' }, 'bad_request'],
    [500, { error: 'server_error', message: 'm' }, 'server_error'],
  ])('maps %i %j to %s', async (status, body, code) => {
    const { api } = setup(() => jsonResponse(status, body));
    await expect(
      api.confirmPhoto(EDIT, { photoId: PHOTO, width: 1, height: 1, lqip: 'x' }),
    ).rejects.toMatchObject({ code, status });
  });

  it('falls back to a code from the status when the body is not JSON', async () => {
    const html = () => new Response('<html>Bad gateway</html>', { status: 502 });
    expect(
      await setup(html)
        .api.reservePhoto(EDIT)
        .catch((e: unknown) => e),
    ).toMatchObject({ code: 'server_error', status: 502 });
    expect(
      await setup(() => new Response('x', { status: 404 }))
        .api.reservePhoto(EDIT)
        .catch((e: unknown) => e),
    ).toMatchObject({ code: 'not_found' });
    expect(
      await setup(() => new Response('x', { status: 429 }))
        .api.reservePhoto(EDIT)
        .catch((e: unknown) => e),
    ).toMatchObject({ code: 'rate_limited' });
  });

  it('reports an unreadable success body as server_error', async () => {
    const { api } = setup(() => new Response('not json', { status: 200 }));
    await expect(api.createMuseum()).rejects.toMatchObject({ code: 'server_error', status: 200 });
  });

  it('reports network failures, cancellation and timeouts distinctly', async () => {
    const network = setup(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(network.api.reservePhoto(EDIT)).rejects.toMatchObject({ code: 'network' });

    const controller = new AbortController();
    const hanging = setup(
      (_url, init) =>
        new Promise((_, reject) =>
          init.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))),
        ),
    );
    const pending = hanging.api.reservePhoto(EDIT, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'aborted' });

    const slow = setup(
      (_url, init) =>
        new Promise((_, reject) =>
          init.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))),
        ),
      { timeoutMs: 10 },
    );
    await expect(slow.api.reservePhoto(EDIT)).rejects.toMatchObject({ code: 'timeout' });
  });
});

describe('createLiveApi retries', () => {
  it('retries reads on network errors and gateway errors, up to twice', async () => {
    let n = 0;
    const flaky = setup(() => {
      n++;
      if (n === 1) return Promise.reject(new TypeError('offline'));
      if (n === 2) return new Response('', { status: 503 });
      return jsonResponse(200, { museum: {}, urlsExpireAt: 'x' });
    });
    await expect(flaky.api.getMuseum('S'.repeat(24))).resolves.toMatchObject({ urlsExpireAt: 'x' });
    expect(flaky.fetchMock).toHaveBeenCalledTimes(3);

    const always = setup(() => new Response('', { status: 502 }));
    await expect(always.api.manageGet(EDIT)).rejects.toMatchObject({ status: 502 });
    expect(always.fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry definite answers, cancellations or writes', async () => {
    const notFound = setup(() => jsonResponse(404, { error: 'not_found', message: 'm' }));
    await expect(notFound.api.getMuseum('S'.repeat(24))).rejects.toMatchObject({
      code: 'not_found',
    });
    expect(notFound.fetchMock).toHaveBeenCalledTimes(1);

    const write = setup(() => Promise.reject(new TypeError('offline')));
    await expect(write.api.reservePhoto(EDIT)).rejects.toMatchObject({ code: 'network' });
    await expect(write.api.publish(EDIT, {} as never)).rejects.toMatchObject({ code: 'network' });
    expect(write.fetchMock).toHaveBeenCalledTimes(2);
  });
});

class FakeXhr {
  static last: FakeXhr | null = null;
  method = '';
  url = '';
  timeout = 0;
  headers: Record<string, string> = {};
  sent: unknown = null;
  status = 0;
  aborted = false;
  upload: {
    onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
  } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.sent = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

describe('createLiveApi uploadPhotoFile', () => {
  const make = () =>
    createLiveApi({
      baseUrl: 'https://abc.supabase.co',
      anonKey: 'k',
      createXhr: () => new FakeXhr() as unknown as XMLHttpRequest,
    });
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });

  it('PUTs the blob to the signed URL with the headers Storage needs, and reports progress', async () => {
    const progress: number[] = [];
    const promise = make().uploadPhotoFile(
      'https://abc.supabase.co/storage/v1/object/upload/sign/photos/a/b/full.jpg?token=t',
      blob,
      (f) => progress.push(f),
    );
    const xhr = FakeXhr.last!;
    expect(xhr.method).toBe('PUT');
    expect(xhr.url).toContain('/object/upload/sign/photos/');
    expect(xhr.headers).toEqual({ 'Content-Type': 'image/jpeg', 'x-upsert': 'true' });
    expect(xhr.sent).toBe(blob);
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 });
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 0, total: 0 });
    xhr.status = 200;
    xhr.onload?.();
    await promise;
    expect(progress).toEqual([0.25, 1]);
  });

  it('maps refusals, network errors, timeouts and cancellation', async () => {
    const run = async (trigger: (x: FakeXhr) => void, signal?: AbortSignal) => {
      const p = make().uploadPhotoFile('u', blob, () => undefined, signal);
      trigger(FakeXhr.last!);
      return p.catch((e: unknown) => e);
    };
    expect(
      await run((x) => {
        x.status = 403;
        x.onload?.();
      }),
    ).toMatchObject({ code: 'server_error', status: 403 });
    expect(await run((x) => x.onerror?.())).toMatchObject({ code: 'network' });
    expect(await run((x) => x.ontimeout?.())).toMatchObject({ code: 'timeout' });
    const controller = new AbortController();
    expect(await run(() => controller.abort(), controller.signal)).toMatchObject({
      code: 'aborted',
    });
    const already = new AbortController();
    already.abort();
    await expect(
      make().uploadPhotoFile('u', blob, () => undefined, already.signal),
    ).rejects.toMatchObject({ code: 'aborted' });
  });
});
