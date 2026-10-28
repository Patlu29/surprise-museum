/**
 * Typed browser API client (ADR 0012). The interface (`MuseumApi`) and the error class
 * (`ApiRequestError`) live in `@/lib/apiPort`, which the stores already use.
 *
 * Two implementations sit behind that interface:
 *   - `createLiveApi`: fetch and XHR to the Supabase Edge Functions;
 *   - `createMockApi`: a faithful backend that runs in the browser and keeps its data in
 *     IndexedDB (else localStorage), so a demo museum survives a reload and opens in a new tab.
 *
 * Call `registerApi()` once at start-up (src/main.tsx) and the rest of the app keeps using
 * `getApi()`. `getApiMode()` tells the UI which one is active, so a demo banner can say that
 * nothing is saved online. Production builds use the live backend unless VITE_API_MODE=mock is
 * set explicitly (see mode.ts).
 */
import { env } from '@/config/env';
import type { MuseumApi } from '@/lib/apiPort';
import { setApiFactory } from '@/lib/apiPort';
import { createAutoDemoStorage, type DemoStorage } from './demoStorage';
import { createLiveApi } from './liveClient';
import { createMockApi, type DemoDataInfo, type MockMuseumApi } from './mockClient';
import { resolveApiMode, type ApiMode } from './mode';

export { createLiveApi, type LiveApiOptions } from './liveClient';
export {
  createMockApi,
  type DemoDataInfo,
  type MockApiOptions,
  type MockMuseumApi,
} from './mockClient';
export {
  createAutoDemoStorage,
  createIndexedDbStorage,
  createLocalStorageStorage,
  createMemoryStorage,
  DemoStorageFullError,
  type DemoStorage,
  type DemoStorageInfo,
  type DemoStorageKind,
} from './demoStorage';
export { resolveApiMode, type ApiMode, type ModeInputs } from './mode';

/** The mode this build runs in, from VITE_API_MODE, the Supabase variables and the build type. */
export function getApiMode(): ApiMode {
  return resolveApiMode({
    supabaseUrl: env.supabaseUrl,
    supabaseAnonKey: env.supabaseAnonKey,
    flag: import.meta.env.VITE_API_MODE as string | undefined,
    production: import.meta.env.PROD,
  });
}

// One demo store and one mock per page, shared by `createApi` and the demo-data helpers.
let demoStorage: DemoStorage | undefined;
let mock: MockMuseumApi | undefined;

function sharedDemoStorage(): DemoStorage {
  return (demoStorage ??= createAutoDemoStorage());
}

function sharedMock(): MockMuseumApi {
  // A little simulated network delay makes loading states visible during development.
  return (mock ??= createMockApi({ storage: sharedDemoStorage(), latencyMs: 150 }));
}

/** Builds the client for the current mode. */
export function createApi(): MuseumApi {
  if (getApiMode() === 'mock') return sharedMock();
  return createLiveApi({
    baseUrl: env.supabaseUrl,
    anonKey: env.supabaseAnonKey,
    region: env.functionsRegion,
  });
}

/** Makes `getApi()` return the client for the current mode. Call once, before rendering. */
export function registerApi(): void {
  setApiFactory(createApi);
}

/**
 * "Clear demo data": deletes every demo museum, photo and draft stored in this browser by the
 * mock, in every tab. Does nothing harmful in live mode (there is no demo data to clear). The UI
 * can call this from a settings or demo-banner control.
 */
export async function clearDemoData(): Promise<void> {
  await sharedMock().reset();
}

/** Counts and storage use for a "Demo data" panel. Call only when `getApiMode()` is `"mock"`. */
export function getDemoDataInfo(): Promise<DemoDataInfo> {
  return sharedMock().info();
}
