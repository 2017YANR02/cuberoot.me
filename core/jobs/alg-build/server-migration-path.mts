import { basename, resolve } from 'node:path';
import { resolveWorkspacePath } from '../../scripts/resolve-workspace-path.mjs';

const CORE_ROOT = resolve(import.meta.dirname, '../..');

export function serverMigrationPath(filename: string): string {
  if (!filename || basename(filename) !== filename) {
    throw new Error(`Expected a migration filename, received: ${filename}`);
  }
  return resolve(CORE_ROOT, resolveWorkspacePath('@cuberoot/server'), 'migrations', filename);
}
