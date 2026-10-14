import { resolve } from 'node:path';

export const CUBEOPT_LEGACY_ENV = [
  'CUBEOPT_DAEMON_SCRIPT',
  'CUBEOPT_MODULE',
  'CUBEOPT_TABLE',
] as const;

export const DEFAULT_CUBEOPT_IDLE_MS = 10 * 60_000;

export function resolveCubeoptThreads(raw: string | undefined): number {
  const parsed = raw?.trim() ? Number(raw) : 2;
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 16) {
    throw new Error('CUBEOPT_THREADS must be an integer from 1 to 16');
  }
  return parsed;
}

export function assertCubeoptReadyLine(line: string, threads: number): void {
  if (line !== `READY\t${threads}`) {
    throw new Error(`solver READY does not match configured threads=${threads}`);
  }
}

/** Zero disables idle unload; invalid values retain the safe default. */
export function resolveCubeoptIdleMs(raw: string | undefined): number {
  const normalized = raw?.trim();
  if (!normalized) return DEFAULT_CUBEOPT_IDLE_MS;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_CUBEOPT_IDLE_MS;
}

export function resolveCubeoptArtifactConfig(env: NodeJS.ProcessEnv) {
  const enabled = env.CUBEOPT_SOLVE_ENABLED === '1';
  const artifactStore = env.CUBEOPT_ARTIFACT_DIR?.trim()
    ? resolve(env.CUBEOPT_ARTIFACT_DIR.trim())
    : null;
  const ignoredLegacy = CUBEOPT_LEGACY_ENV.filter((name) => env[name]?.trim());

  return {
    enabled,
    artifactStore,
    configError: enabled && artifactStore === null
      ? 'CUBEOPT_ARTIFACT_DIR is required when CUBEOPT_SOLVE_ENABLED=1; no legacy, Web, or repository path fallback is allowed'
      : null,
    warning: enabled && artifactStore !== null && ignoredLegacy.length > 0
      ? `ignoring legacy ${ignoredLegacy.join(', ')} because CUBEOPT_ARTIFACT_DIR is the only runtime artifact source`
      : null,
  };
}

export function cubeoptChildEnv(env: NodeJS.ProcessEnv, artifactStore: string) {
  const childEnv: NodeJS.ProcessEnv = { ...env, CUBEOPT_ARTIFACT_DIR: artifactStore };
  for (const name of CUBEOPT_LEGACY_ENV) delete childEnv[name];
  return childEnv;
}
