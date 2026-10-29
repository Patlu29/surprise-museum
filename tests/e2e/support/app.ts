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
  visitor: { x: number; z: number; heading: number; speed: number; locomotion: string; presentation: string };
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
 * Warnings that are known and not the app's fault. They are listed in docs/qa-report.md (BUG-5 and
 * note N-1) so they stay visible; anything else that mentions WebGL, three, shaders or GLSL fails.
 */
const KNOWN_WARNINGS = [
  // react-three-fiber 9 still constructs THREE.Clock (three 0.186 deprecates it). Library noise.
  /THREE\.Clock/,
  // SwiftShader (the software GL used in headless runs) reports every readPixels as a stall.
  /GL Driver Message .*GPU stall/,
];

/**
 * Collect console errors, uncaught exceptions, failed requests and WebGL or three.js warnings.
 * Call `expectClean()` at the end of a test.
 */
export function trackProblems(page: Page): Problems & { expectClean: () => void } {
  const problems: Problems = { consoleErrors: [], pageErrors: [], failedRequests: [], warnings: [] };
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !IGNORED_CONSOLE.some((re) => re.test(text))) {
      problems.consoleErrors.push(text);
    }
    if (
      msg.type() === 'warning' &&
      /webgl|three|shader|glsl/i.test(text) &&
      !KNOWN_WARNINGS.some((re) => re.test(text))
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

export interface MuseumOptions {
  photos?: number | UploadFile[];
  captions?: string[];
  visitorName?: string;
  guideName?: string;
  title?: string;
  closingMessage?: string;
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
  await page.waitForFunction(() => (globalThis as unknown as PageGlobals).__surpriseMuseum !== undefined && ((globalThis as unknown as PageGlobals).__surpriseMuseum!.snapshot() as Snap).ready === true, null, {
    timeout: 60_000,
  });
}

export async function snap(page: Page): Promise<Snap> {
  return page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.snapshot() as Snap);
}

export async function layout(page: Page): Promise<Layout> {
  return page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.layout() as Layout);
}

/** Poll the snapshot until `predicate` holds. */
export async function waitForSnap(
  page: Page,
  predicate: (s: Snap) => boolean,
  timeout = 20_000,
  message = 'snapshot condition',
): Promise<Snap> {
  const deadline = Date.now() + timeout;
  let last = await snap(page);
  while (Date.now() < deadline) {
    if (predicate(last)) return last;
    await page.waitForTimeout(150);
    last = await snap(page);
  }
  throw new Error(`Timed out waiting for ${message}. Last: ${JSON.stringify(last).slice(0, 600)}`);
}

export function attachJson(testInfo: TestInfo, name: string, value: unknown) {
  return testInfo.attach(name, { body: JSON.stringify(value, null, 2), contentType: 'application/json' });
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
export async function sessionState<T>(page: Page, pick: (state: Record<string, any>) => T): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
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
