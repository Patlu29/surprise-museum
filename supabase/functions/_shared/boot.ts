/**
 * Process start-up shared by the four functions: read the environment once, build the real
 * backend, and answer 500 (without detail) if configuration is missing, so a misconfigured
 * deploy fails loudly in the logs but leaks nothing to callers.
 */
import { ConfigError, loadConfig, type RuntimeConfig } from './config.ts';
import { ApiException, errorBody, jsonResponse } from './http.ts';
import type { MuseumStore, PhotoStorage } from './ports.ts';
import { createSupabaseBackend } from './supabaseBackend.ts';

export interface Runtime {
  config: RuntimeConfig;
  store: MuseumStore;
  storage: PhotoStorage;
}

let cached: Runtime | undefined;

export function getRuntime(): Runtime {
  if (!cached) {
    const config = loadConfig((name) => Deno.env.get(name));
    cached = { config, ...createSupabaseBackend(config) };
  }
  return cached;
}

/** Builds the request handler on the first request, so a bad configuration returns a JSON 500. */
export function lazyHandler(
  name: string,
  build: (runtime: Runtime) => (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  let handler: ((request: Request) => Promise<Response>) | undefined;
  return (request) => {
    try {
      handler ??= build(getRuntime());
    } catch (error) {
      // Names of missing variables are safe to log; values never are.
      console.error(`${name}: ${error instanceof ConfigError ? error.message : 'failed to start'}`);
      return Promise.resolve(
        jsonResponse(
          500,
          errorBody(new ApiException('server_error', 'The service is not configured.')),
        ),
      );
    }
    return handler(request);
  };
}
