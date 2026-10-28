export interface LiveConfigResult {
  ok: boolean;
  problems: string[];
  summary: string;
}
export function checkLiveConfig(env: Record<string, string | undefined>): LiveConfigResult;
export function parseEnvFile(text: string): Record<string, string>;
export function formatProblems(problems: string[]): string;
export interface RequireLiveBackendOptions {
  /** Check in every build, not only when VITE_API_MODE=live. */
  force?: boolean;
}
export function requireLiveBackend(options?: RequireLiveBackendOptions): {
  name: string;
  apply: 'build';
  configResolved(config: { env: Record<string, unknown> }): void;
};
