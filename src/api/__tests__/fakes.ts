/** Small in-memory fakes of IndexedDB and localStorage, enough for src/api/demoStorage.ts. */

type Listener = ((event?: unknown) => void) | null;

class FakeRequest<T> {
  result!: T;
  error: Error | null = null;
  onsuccess: Listener = null;
  onerror: Listener = null;
}

export class FakeIdbDatabase {
  onversionchange: Listener = null;
  closed = false;
  private readonly data: Map<string, unknown>;
  private readonly failWith: () => Error | null;
  constructor(data: Map<string, unknown>, failWith: () => Error | null) {
    this.data = data;
    this.failWith = failWith;
  }
  objectStoreNames = { contains: () => true };
  createObjectStore() {
    return {};
  }
  close() {
    this.closed = true;
  }
  transaction() {
    const tx = {
      oncomplete: null as Listener,
      onerror: null as Listener,
      onabort: null as Listener,
      error: null as Error | null,
      objectStore: () => store,
    };
    const run = <T>(work: () => T, write: boolean): FakeRequest<T> => {
      const req = new FakeRequest<T>();
      setTimeout(() => {
        const failure = write ? this.failWith() : null;
        if (failure) {
          req.error = failure;
          tx.error = failure;
          req.onerror?.();
          tx.onerror?.();
          return;
        }
        req.result = work();
        req.onsuccess?.();
        setTimeout(() => tx.oncomplete?.(), 0);
      }, 0);
      return req;
    };
    const store = {
      get: (key: string) =>
        run(() => (this.data.has(key) ? structuredClone(this.data.get(key)) : undefined), false),
      put: (value: unknown, key: string) =>
        run(() => {
          this.data.set(key, structuredClone(value));
          return key;
        }, true),
      delete: (key: string) =>
        run(() => {
          this.data.delete(key);
          return undefined;
        }, true),
      clear: () =>
        run(() => {
          this.data.clear();
          return undefined;
        }, true),
    };
    return tx;
  }
}

/** One factory is one browser profile: databases opened from it share the same data. */
export class FakeIdbFactory {
  readonly data = new Map<string, unknown>();
  failOpen = false;
  /** Makes every write fail with this error name (for example QuotaExceededError). */
  failWritesWith: string | null = null;
  open() {
    const req = new FakeRequest<FakeIdbDatabase>() as FakeRequest<FakeIdbDatabase> & {
      onupgradeneeded: Listener;
      onblocked: Listener;
    };
    req.onupgradeneeded = null;
    req.onblocked = null;
    setTimeout(() => {
      if (this.failOpen) {
        req.error = new Error('open refused');
        req.onerror?.();
        return;
      }
      req.result = new FakeIdbDatabase(this.data, () => {
        if (!this.failWritesWith) return null;
        const error = new Error('write refused');
        error.name = this.failWritesWith;
        return error;
      });
      req.onupgradeneeded?.();
      req.onsuccess?.();
    }, 0);
    return req;
  }
}

export class FakeLocalStorage {
  private readonly map = new Map<string, string>();
  private readonly quotaChars: number;
  /** Total characters allowed across all values; writes beyond it throw like a full quota. */
  constructor(quotaChars = Infinity) {
    this.quotaChars = quotaChars;
  }
  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    let total = value.length;
    for (const [k, v] of this.map) if (k !== key) total += v.length;
    if (total > this.quotaChars) {
      const error = new Error('quota');
      error.name = 'QuotaExceededError';
      throw error;
    }
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  keys() {
    return [...this.map.keys()];
  }
}
