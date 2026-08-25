import { resolve } from 'node:path';

export const CUBEOPT_LEGACY_ENV = [
  'CUBEOPT_DAEMON_SCRIPT',
  'CUBEOPT_MODULE',
  'CUBEOPT_TABLE',
] as const;

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
