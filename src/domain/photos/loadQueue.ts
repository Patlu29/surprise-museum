/**
 * Priority download queue for the wall photos (ADR 0005, architecture 6.10, NFR-3).
 * Nearest first, 3 at a time, re-ranked on demand. Pure TypeScript: the actual download is
 * injected, so the scheduling is unit-tested with fake loaders and fake timers.
 */

export type LoadStatus = 'placeholder' | 'loading' | 'loaded' | 'failed';

/** Thrown by a loader; `status` is the HTTP status when there was one. */
export class LoadError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'LoadError';
    this.status = status;
  }
}

export interface LoadQueueOptions<T> {
  /** Download and decode one photo. Honour the signal when aborted. */
  load: (id: string, url: string, signal: AbortSignal) => Promise<T>;
  onStatus: (id: string, status: LoadStatus) => void;
  onLoaded: (id: string, value: T) => void;
  /** Called once when a 400 or 403 suggests the signed URLs expired. Then call updateUrls. */
  onUrlsExpired?: () => void;
  concurrency?: number;
  /** Delays before each retry (ms). Defaults to 1 s, 3 s, 9 s. */
  backoffMs?: readonly number[];
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

interface Job {
  id: string;
  url: string;
  status: LoadStatus;
  /** Smaller is more urgent. Infinity means unranked. */
  priority: number;
  attempts: number;
  controller: AbortController | null;
  timer: unknown;
  waitingForUrls: boolean;
}

export class PhotoLoadQueue<T> {
  private readonly jobs = new Map<string, Job>();
  private readonly concurrency: number;
  private backoff: readonly number[];
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private readonly opts: LoadQueueOptions<T>;
  private active = 0;
  private refreshRequested = false;
  private refreshPending = false;
  private readonly preRank = new Map<string, number>();
  private disposed = false;

  constructor(options: LoadQueueOptions<T>) {
    this.opts = options;
    this.concurrency = options.concurrency ?? 3;
    this.backoff = options.backoffMs ?? [1000, 3000, 9000];
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer =
      options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /** Register photos. Existing ids keep their state; new ids start as placeholders. */
  add(photos: ReadonlyArray<{ id: string; url: string }>): void {
    for (const p of photos) {
      if (this.jobs.has(p.id)) continue;
      this.jobs.set(p.id, {
        id: p.id,
        url: p.url,
        status: 'placeholder',
        priority: this.preRank.get(p.id) ?? Infinity,
        attempts: 0,
        controller: null,
        timer: null,
        waitingForUrls: false,
      });
      this.opts.onStatus(p.id, 'placeholder');
    }
    this.pump();
  }

  /** New signed URLs (after expiry). Jobs that were waiting restart with a clean slate. */
  updateUrls(photos: ReadonlyArray<{ id: string; url: string }>): void {
    this.refreshPending = false;
    for (const p of photos) {
      const job = this.jobs.get(p.id);
      if (!job) continue;
      job.url = p.url;
      if (job.waitingForUrls) {
        job.waitingForUrls = false;
        job.attempts = 0;
        job.status = 'placeholder';
        this.opts.onStatus(job.id, 'placeholder');
      }
    }
    this.pump();
  }

  /** Re-rank by distance (smaller first). Ids not listed keep their rank. */
  rank(distances: ReadonlyMap<string, number>): void {
    for (const [id, d] of distances) {
      const job = this.jobs.get(id);
      if (job) job.priority = d;
      else this.preRank.set(id, d);
    }
    this.pump();
  }

  /** Retry a failed (or stalled) photo from the start. */
  retry(id: string): void {
    const job = this.jobs.get(id);
    if (!job || job.status === 'loaded' || job.status === 'loading') return;
    if (job.timer !== null) this.clearTimer(job.timer);
    job.timer = null;
    job.attempts = 0;
    job.waitingForUrls = false;
    job.status = 'placeholder';
    job.priority = -1; // the Visitor asked for it: go first
    this.opts.onStatus(id, 'placeholder');
    this.pump();
  }

  /** Mark a photo failed at once, even if it had loaded or was downloading (test hook). */
  forceFail(id: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.controller?.abort();
    job.controller = null;
    if (job.timer !== null) this.clearTimer(job.timer);
    job.timer = null;
    job.waitingForUrls = false;
    job.status = 'failed';
    this.opts.onStatus(id, 'failed');
  }

  /** Replace the retry delays (tests shorten them). */
  setBackoff(delaysMs: readonly number[]): void {
    this.backoff = delaysMs;
  }

  statusOf(id: string): LoadStatus | undefined {
    return this.jobs.get(id)?.status;
  }

  /** Number of photos not yet loaded or failed. Drives the scene's loading progress. */
  get pendingCount(): number {
    let n = 0;
    for (const j of this.jobs.values())
      if (j.status === 'placeholder' || j.status === 'loading') n++;
    return n;
  }

  get activeCount(): number {
    return this.active;
  }

  dispose(): void {
    this.disposed = true;
    for (const job of this.jobs.values()) {
      job.controller?.abort();
      if (job.timer !== null) this.clearTimer(job.timer);
    }
    this.jobs.clear();
  }

  // ---- Internals ---------------------------------------------------------------------------

  private pump(): void {
    if (this.disposed) return;
    while (this.active < this.concurrency) {
      let next: Job | null = null;
      for (const job of this.jobs.values()) {
        if (job.status !== 'placeholder' || job.timer !== null || job.waitingForUrls) continue;
        if (!next || job.priority < next.priority) next = job;
      }
      if (!next) return;
      this.start(next);
    }
  }

  private start(job: Job): void {
    this.active++;
    job.status = 'loading';
    job.controller = new AbortController();
    this.opts.onStatus(job.id, 'loading');
    const { signal } = job.controller;

    this.opts
      .load(job.id, job.url, signal)
      .then((value) => {
        this.active--;
        if (this.disposed || signal.aborted) return;
        job.status = 'loaded';
        job.controller = null;
        this.opts.onStatus(job.id, 'loaded');
        this.opts.onLoaded(job.id, value);
        this.pump();
      })
      .catch((error: unknown) => {
        this.active--;
        if (this.disposed || signal.aborted) return;
        job.controller = null;
        this.fail(job, error);
        this.pump();
      });
  }

  private fail(job: Job, error: unknown): void {
    const status = error instanceof LoadError ? error.status : undefined;
    const expired = status === 400 || status === 403;
    if (expired && (this.refreshPending || !this.refreshRequested) && this.opts.onUrlsExpired) {
      // One refresh of the signed URLs, then everything waiting restarts (ADR 0005).
      job.waitingForUrls = true;
      job.status = 'placeholder';
      this.opts.onStatus(job.id, 'loading');
      if (!this.refreshRequested) {
        this.refreshRequested = true;
        this.refreshPending = true;
        this.opts.onUrlsExpired();
      }
      return;
    }
    const delay = this.backoff[job.attempts];
    job.attempts++;
    if (delay === undefined) {
      job.status = 'failed';
      this.opts.onStatus(job.id, 'failed');
      return;
    }
    job.status = 'placeholder';
    this.opts.onStatus(job.id, 'loading');
    job.timer = this.setTimer(() => {
      job.timer = null;
      this.pump();
    }, delay);
  }
}
