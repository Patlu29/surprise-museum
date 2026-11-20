import { expect, type Page, type TestInfo } from '@playwright/test';
import { makePhotos, type UploadFile } from './images';

/**
 * tests/e2e is type-checked by tsconfig.node.json, which has no DOM lib, so code that runs inside
 * the page reaches the browser through this typed view of `globalThis`.
 */
export interface PageGlobals {
  /** Present only in `--mode test` builds (src/main.tsx). The zustand stores, loosely typed. */
  __APP_TEST__?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  __surpriseMuseum?: {
    snapshot(): unknown;
    layout(): unknown;
    teleportVisitor(x: number, z: number, heading?: number): void;
    walkVisitorTo(x: number, z: number, timeoutMs?: number): Promise<boolean>;
    standAtPhoto(index: number): boolean;
    standAtFinale(): void;
    replay(): void;
    failPhoto(id: string): void;
    retryPhoto(id: string): void;
  };
}

/** The app's own scene test hooks (src/scene/controllers/testHooks.ts), typed loosely on purpose. */
export interface Snap {
  ready: boolean;
  time: number;
  visitor: {
    x: number;
    z: number;
    heading: number;
    speed: number;
    locomotion: string;
    presentation: string;
  };
  guide: {
    x: number;
    z: number;
    mode: string;
    opacity: number;
    gesture: string;
    locomotion: string;
    presentation: string;
  };
  intent: string;
  dwell: { photoId: string | null; progress: number };
  finaleReached: boolean;
  photoStatus: Record<string, string>;
  camera: { yaw: number; pitch: number; offDefault: boolean };
  render: { calls: number; triangles: number; textures: number };
  labels: { visitor: boolean; guide: boolean };
  quality: string | null;
  /** CR-2 hook (design spec 6.12.9). `pending` and `veil` are as built. */
  presentationCamera: PresentationCameraSnap;
}
export interface PresentationCameraSnap {
  mode: 'follow' | 'pending' | 'entering' | 'framed' | 'returning' | 'cut';
  yawOffsetDeg: number;
  pictureVisibleFraction: number;
  fallback: boolean;
  guideDropped: boolean;
  settled: boolean;
  pending: boolean;
  cutSeq: number;
  settledSeq: number;
  lastMoveInMs: number;
  lastMoveOutMs: number;
  photoId: string | null;
  veil: number;
  /** The camera's yaw as shown, in degrees, from the look direction (updated every frame). */
  shownYawDeg: number;
  /** N-6: the Guide's presentation progress, or null when nothing is being presented. */
  guidePresenting: { photoId: string; arrived: boolean } | null;
}
export interface Layout {
  rooms: Array<{ kind: string; minZ: number; maxZ: number }>;
  slots: Array<{
    photoId: string;
    index: number;
    zone: { x: number; z: number };
    standingSpot: { x: number; z: number };
    wall: string;
  }>;
  finale: { x: number; z: number; triggerRadius: number };
  spawn: { x: number; z: number };
}

export interface Problems {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  warnings: string[];
}

/** Messages that come from the browser or a library, not from this app, and are not defects. */
const IGNORED_CONSOLE = [
  // Chromium reports blocked favicon requests under some preview servers.
  /favicon/i,
];

/**
 * Console errors that only WebKit reports, and only for a deliberate part of the app. Playwright's WebKit
 * on Linux logs the viewport meta key `interactive-widget` as an error (macOS WebKit stays silent). The
 * key is intentional (FR-84, index.html): it makes Android Chrome and Firefox resize the layout when the
 * on-screen keyboard opens, and WebKit ignores it harmlessly. The match is anchored to this exact message
 * and applies on WebKit only, so every other console error, and this one on any other engine, still fails.
 */
const WEBKIT_ONLY_CONSOLE = [
  /^Viewport argument key "interactive-widget" not recognized and ignored\.$/,
];

/**
 * Warnings that only WebKit reports. Linux CI run 44676952911 (commit b947f7c) failed mobile-webkit with WebKit's
 * resource-hint notice for `assets/three-<hash>.js`: Vite's dynamic-import helper adds a modulepreload when the
 * lazy 3D route loads, and tests that open a museum and navigate away quickly never execute the chunk within
 * WebKit's "few seconds" window on a slow runner. It reached the warnings bucket only because the asset file name
 * contains "three". The match is anchored to this message shape and applies on WebKit only; a real three.js or
 * WebGL warning, or this notice on another engine, still fails.
 */
const WEBKIT_ONLY_WARNINGS = [
  /^The resource \S+ was preloaded using link preload but not used within a few seconds from the window's load event\. Please make sure it wasn't preloaded for nothing\.$/,
];

/**
 * Warnings that are known and not the app's fault. They are listed in docs/qa-report.md (BUG-5, accepted as
 * an upstream warning in docs/decisions/0018-accept-three-clock-deprecation-warning.md, and note N-1); anything else that mentions WebGL, three, shaders or GLSL fails.
 */
const KNOWN_WARNINGS = [
  // ADR 0018 (BUG-5, accepted, upstream): react-three-fiber 9 still constructs THREE.Clock (three 0.186
  // deprecates it). Remove this entry when a stable R3F release replaces Clock with Timer.
  /THREE\.Clock/,
  // SwiftShader (the software GL used in headless runs) reports every readPixels as a stall.
  /GL Driver Message .*GPU stall/,
];

/**
 * Collect console errors, uncaught exceptions, failed requests and WebGL or three.js warnings.
 * Call `expectClean()` at the end of a test.
 */
export function trackProblems(page: Page): Problems & { expectClean: () => void } {
  const problems: Problems = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    warnings: [],
  };
  const isWebKit = page.context().browser()?.browserType().name() === 'webkit';
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      msg.type() === 'error' &&
      !IGNORED_CONSOLE.some((re) => re.test(text)) &&
      !(isWebKit && WEBKIT_ONLY_CONSOLE.some((re) => re.test(text)))
    ) {
      problems.consoleErrors.push(text);
    }
    if (
      msg.type() === 'warning' &&
      /webgl|three|shader|glsl/i.test(text) &&
      !KNOWN_WARNINGS.some((re) => re.test(text)) &&
      !(isWebKit && WEBKIT_ONLY_WARNINGS.some((re) => re.test(text)))
    ) {
      problems.warnings.push(text);
    }
  });
  page.on('pageerror', (error) => problems.pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const url = request.url();
    // Blob and data URLs are the app's own; an aborted navigation or image swap is not a failure.
    if (/^(blob|data):/.test(url)) return;
    const reason = request.failure()?.errorText ?? '';
    if (/ABORTED|abort|cancel/i.test(reason)) return;
    problems.failedRequests.push(`${request.method()} ${url} ${reason}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().startsWith('http://localhost')) {
      problems.failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });
  return {
    ...problems,
    expectClean: () => {
      expect(problems.pageErrors, 'uncaught exceptions').toEqual([]);
      expect(problems.consoleErrors, 'console errors').toEqual([]);
      expect(problems.failedRequests, 'failed network requests').toEqual([]);
      expect(problems.warnings, 'WebGL or three.js warnings').toEqual([]);
    },
  };
}

/**
 * FR-15: the builder preview shows a change within 1 second. Measured here by polling element screenshots, so the
 * figure includes the cost of each screenshot. On CI (2-core Linux runners, SwiftShader software GL, no GPU) the
 * same change took 1.1 to 2.7 s, which says how slow a software renderer is and not how fast a phone is. So CI
 * gets a 4 s budget, still short enough to catch a preview that waits on a timer or a reload. The real 1 s figure
 * is checked only where the tests run on a developer machine (CI unset) and on a real device it is Not verified.
 */
export const FR15_BUDGET_MS = process.env.CI ? 4000 : 1000;

/**
 * Upper bound for the caption card upgrade delay (design spec 3.5 U1), in ms. The rule is a 600 ms dwell sampled
 * every 100 ms, and the local window is 500 to 1,100 ms. Shared CI runners are not timing evidence: Linux run
 * 44457523893 measured 1104.9 ms on mobile-chromium. So CI gets 1,500 ms (tech lead decision, 20/11/2026). The lower
 * bound is unchanged everywhere, so an upgrade that happens too early still fails.
 */
export const CARD_UPGRADE_MAX_MS = process.env.CI ? 1500 : 1100;

export interface MuseumOptions {
  photos?: number | UploadFile[];
  captions?: string[];
  visitorName?: string;
  guideName?: string;
  title?: string;
  closingMessage?: string;
  /** Runs while the Characters step is showing, before moving on to Review (CR-1 tests choose genders here). */
  onCharacters?: (page: Page) => Promise<void>;
}

export interface Published {
  shareToken: string;
  editToken: string;
  shareUrl: string;
  editUrl: string;
  visitorName: string;
  guideName: string;
  title: string;
  closingMessage: string;
  photos: number;
}

export function tokenFrom(url: string): string {
  return url.split('/').pop() ?? '';
}

/** Add photos on step 1 and wait until every row says it is ready. */
export async function addPhotos(page: Page, files: UploadFile[]): Promise<void> {
  await page.locator('input[type=file]').first().setInputFiles(files);
  await expect(page.locator('.photo-list > li')).toHaveCount(files.length, { timeout: 60_000 });
  await expect(page.locator('.photo-row__status--ready')).toHaveCount(files.length, {
    timeout: 90_000,
  });
}

/** Step 2 to the end of step 3: names, title, closing message, then to Review. */
export async function fillWords(page: Page, o: MuseumOptions): Promise<void> {
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Who is this museum for?').fill(o.visitorName ?? 'Alex');
  await page.getByLabel('Your name').fill(o.guideName ?? 'Sam');
  if (o.title !== undefined) await page.getByLabel('Museum title (optional)').fill(o.title);
  if (o.closingMessage !== undefined) {
    await page.getByLabel('Closing message (optional)').fill(o.closingMessage);
  }
  await page.getByRole('button', { name: 'Next' }).click(); // characters
  if (o.onCharacters) {
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
    await o.onCharacters(page);
  }
  await page.getByRole('button', { name: 'Next' }).click(); // review
}

/** Build a museum through the real builder UI, publish it and return the links. */
export async function createMuseum(page: Page, options: MuseumOptions = {}): Promise<Published> {
  const files =
    typeof options.photos === 'object' ? options.photos : makePhotos(options.photos ?? 3);
  await page.goto('./?e2e=1#/create');
  await addPhotos(page, files);
  const captions = options.captions ?? files.map((_, i) => `Caption for photo ${i + 1}.`);
  const boxes = page.getByLabel('Caption (optional)');
  for (let i = 0; i < captions.length && i < files.length; i++) {
    if (captions[i]) await boxes.nth(i).fill(captions[i]!);
  }
  await fillWords(page, options);
  await page.getByRole('checkbox', { name: /I have the right to share/ }).check();
  const publish = page.getByRole('button', { name: /Publish museum/ });
  await expect(publish).not.toHaveAttribute('aria-disabled', 'true', { timeout: 60_000 });
  await publish.click();
  await expect(page.getByRole('heading', { name: 'Your museum is ready' })).toBeVisible({
    timeout: 60_000,
  });
  const share = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
  const edit = await page.getByRole('textbox', { name: 'Private edit link' }).inputValue();
  return {
    shareToken: tokenFrom(share),
    editToken: tokenFrom(edit),
    shareUrl: share,
    editUrl: edit,
    visitorName: options.visitorName ?? 'Alex',
    guideName: options.guideName ?? 'Sam',
    title: options.title ?? '',
    closingMessage: options.closingMessage ?? '',
    photos: files.length,
  };
}

/** Open a published museum in the same browser context (the demo backend lives in its IndexedDB). */
export async function openVisit(page: Page, token: string, extra = ''): Promise<void> {
  // A hash-only change would route inside the already loaded page. Start from a blank page so the
  // Visitor's load is a real, fresh page load (new JS context, init scripts and CSP apply).
  await page.goto('about:blank');
  await page.goto(`./?e2e=1${extra}#/m/${token}`);
}

/** Press Start and wait until the scene has rendered and the visitor can move. */
export async function startVisit(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start' }).click();
  await waitForScene(page);
}

export async function waitForScene(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (globalThis as unknown as PageGlobals).__surpriseMuseum !== undefined &&
      ((globalThis as unknown as PageGlobals).__surpriseMuseum!.snapshot() as Snap).ready === true,
    null,
    {
      timeout: 60_000,
    },
  );
}

export async function snap(page: Page): Promise<Snap> {
  return page.evaluate(
    () => (globalThis as unknown as PageGlobals).__surpriseMuseum!.snapshot() as Snap,
  );
}

export async function layout(page: Page): Promise<Layout> {
  return page.evaluate(
    () => (globalThis as unknown as PageGlobals).__surpriseMuseum!.layout() as Layout,
  );
}

/** Poll the snapshot until `predicate` holds. */
export async function waitForSnap(
  page: Page,
  predicate: (s: Snap) => boolean,
  timeout = 20_000,
  message = 'snapshot condition',
): Promise<Snap> {
  const deadline = Date.now() + timeout;
  // The scene hook appears when the museum canvas mounts, which can be after Start on a slow device.
  await page.waitForFunction(
    () => (globalThis as unknown as PageGlobals).__surpriseMuseum !== undefined,
    null,
    { timeout },
  );
  let last = await snap(page);
  while (Date.now() < deadline) {
    if (predicate(last)) return last;
    await page.waitForTimeout(150);
    last = await snap(page);
  }
  throw new Error(`Timed out waiting for ${message}. Last: ${JSON.stringify(last).slice(0, 600)}`);
}

export function attachJson(testInfo: TestInfo, name: string, value: unknown) {
  return testInfo.attach(name, {
    body: JSON.stringify(value, null, 2),
    contentType: 'application/json',
  });
}

/** Cut the Visitor to a point, facing `heading` (radians). */
export async function teleport(page: Page, x: number, z: number, heading?: number): Promise<void> {
  await page.evaluate(
    ([px, pz, h]) =>
      (globalThis as unknown as PageGlobals).__surpriseMuseum!.teleportVisitor(
        px as number,
        pz as number,
        (h as number | null) ?? undefined,
      ),
    [x, z, heading ?? null] as const,
  );
}

/** Heading that faces a wall: the left wall is at -x and the right wall at +x. */
export const FACE_LEFT_WALL = -Math.PI / 2;
export const FACE_RIGHT_WALL = Math.PI / 2;

/** Read the session store (mode test builds only). */
export async function sessionState<T>(
  page: Page,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pick: (state: Record<string, any>) => T,
): Promise<T> {
  return page.evaluate(
    `(${pick.toString()})((globalThis).__APP_TEST__.useSessionStore.getState())`,
  ) as Promise<T>;
}

/** Visible caption card text, or null when no panel is open. */
export function captionCard(page: Page) {
  return page.locator('.caption-card');
}

/** Distance between two points on the floor plan. */
export function dist(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// ---------------------------------------------------------------------------
// CR-1 (gender), CR-3 (restored-draft notice) and CR-2 (presentation camera) helpers
// ---------------------------------------------------------------------------

export const DRAFT_KEY = 'surprise-museum:draft:v1';

/** The two default characters exactly as v0.2 stored them: no `gender` key at all. */
export const LEGACY_GUIDE_AVATAR = {
  v: 1,
  skinTone: 'skin-04',
  hairStyle: 'short-crop',
  hairColor: 'dark-brown',
  outfitStyle: 'shirt-trousers',
  outfitColor: 'navy',
  bodyType: 'regular',
  height: 'medium',
  facialHair: 'none',
  glasses: 'none',
  hat: 'none',
} as const;
export const LEGACY_VISITOR_AVATAR = {
  v: 1,
  skinTone: 'skin-04',
  hairStyle: 'bob',
  hairColor: 'brown',
  outfitStyle: 'jumpsuit',
  outfitColor: 'coral',
  bodyType: 'regular',
  height: 'medium',
  facialHair: 'none',
  glasses: 'none',
  hat: 'none',
} as const;

export interface DraftSeed {
  step?: 1 | 2 | 3 | 4;
  title?: string;
  visitorName?: string;
  guideName?: string;
  closingMessage?: string;
  guideAvatar?: Record<string, unknown>;
  visitorAvatar?: Record<string, unknown>;
}

/** Write a draft into localStorage (as an earlier visit would have) and open the builder on it. */
export async function seedDraftAndOpen(page: Page, seed: DraftSeed): Promise<void> {
  await page.goto('./?e2e=1');
  const step = seed.step ?? 3;
  const draft = {
    version: 1,
    step,
    maxStep: step,
    fields: {
      title: seed.title ?? '',
      visitorName: seed.visitorName ?? '',
      guideName: seed.guideName ?? '',
      closingMessage: seed.closingMessage ?? '',
      guideAvatar: seed.guideAvatar ?? LEGACY_GUIDE_AVATAR,
      visitorAvatar: seed.visitorAvatar ?? LEGACY_VISITOR_AVATAR,
    },
  };
  await page.evaluate(
    ([key, value]) =>
      (
        globalThis as unknown as { localStorage: { setItem(k: string, v: string): void } }
      ).localStorage.setItem(key as string, value as string),
    [DRAFT_KEY, JSON.stringify(draft)] as const,
  );
  await page.goto('about:blank');
  await page.goto('./?e2e=1#/create');
}

/** Read the draft key back as parsed JSON (or null). */
export async function savedDraft(page: Page): Promise<{
  fields: { guideAvatar: Record<string, unknown>; visitorAvatar: Record<string, unknown> };
} | null> {
  const raw = await page.evaluate(
    (key) =>
      (
        globalThis as unknown as { localStorage: { getItem(k: string): string | null } }
      ).localStorage.getItem(key),
    DRAFT_KEY,
  );
  return raw ? (JSON.parse(raw) as never) : null;
}

/** Both avatars as the builder store holds them (mode test builds only). */
export async function builderAvatars(
  page: Page,
): Promise<{ guide: Record<string, string>; visitor: Record<string, string> }> {
  return page.evaluate(
    `(() => { const s = globalThis.__APP_TEST__.useBuilderStore.getState(); return { guide: { ...s.guideAvatar }, visitor: { ...s.visitorAvatar } }; })()`,
  ) as never;
}

/** Both avatars of the museum currently loaded for a visit or preview. */
export async function museumAvatars(
  page: Page,
): Promise<{ guide: Record<string, string>; visitor: Record<string, string> }> {
  return page.evaluate(
    `(() => { const c = globalThis.__APP_TEST__.useMuseumStore.getState().content; return { guide: { ...c.guideAvatar }, visitor: { ...c.visitorAvatar } }; })()`,
  ) as never;
}

/**
 * Edit the demo backend's stored state in IndexedDB, to build the data an older release would have
 * written. `mutate` runs in the page on the parsed state (`{ v, museums, photos }`) and may change it.
 * Returns the number of museums found.
 */
export async function rewriteDemoState(page: Page, mutateSource: string): Promise<number> {
  return page.evaluate(
    `(async () => {
      const open = () => new Promise((resolve, reject) => {
        const r = globalThis.indexedDB.open('surprise-museum-demo', 1);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const db = await open();
      const get = () => new Promise((resolve, reject) => {
        const r = db.transaction('kv', 'readonly').objectStore('kv').get('state');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const text = await get();
      if (typeof text !== 'string') { db.close(); return 0; }
      const state = JSON.parse(text);
      (${mutateSource})(state);
      await new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(JSON.stringify(state), 'state');
        tx.oncomplete = () => resolve(null);
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return Object.keys(state.museums).length;
    })()`,
  ) as Promise<number>;
}

/** The stored demo museums, as JSON, for assertions about what was (or was not) written. */
export async function readDemoState(page: Page): Promise<{
  museums: Record<
    string,
    {
      status: string;
      document: {
        guideAvatar: Record<string, unknown>;
        visitorAvatar: Record<string, unknown>;
      } | null;
    }
  >;
}> {
  await rewriteDemoState(
    page,
    `(state) => { globalThis.__qaState = JSON.parse(JSON.stringify(state)); }`,
  );
  return (await page.evaluate(`globalThis.__qaState`)) as never;
}

/** Remove `gender` from every stored avatar: a museum published before v0.3. */
export async function makeStoredMuseumsLegacy(page: Page): Promise<number> {
  return rewriteDemoState(
    page,
    `(state) => { for (const m of Object.values(state.museums)) { delete m.document.guideAvatar.gender; delete m.document.visitorAvatar.gender; } }`,
  );
}

/** Add 1 photo and reach the Characters step through the real UI. */
export async function toCharactersStep(
  page: Page,
  visitorName = 'Alex',
  guideName = 'Sam',
): Promise<void> {
  await page.goto('./?e2e=1#/create');
  await expect(page.getByRole('heading', { level: 1, name: 'Photos' })).toBeVisible();
  await addPhotos(page, makePhotos(1));
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel(/Who is this museum for/).fill(visitorName);
  await page.getByLabel(/Your name/).fill(guideName);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
}

/** Choose a gender tile for a character on the Body tab. */
export async function chooseGender(
  page: Page,
  role: 'Guide' | 'Visitor',
  label: 'Woman' | 'Man' | 'Neutral',
): Promise<void> {
  await page.getByRole('tab', { name: new RegExp(`^${role}`) }).click();
  await page.getByRole('tab', { name: 'Body' }).click();
  await page
    .getByRole('radiogroup', { name: 'Gender (optional)' })
    .getByRole('radio', { name: label, exact: true })
    .click();
}
